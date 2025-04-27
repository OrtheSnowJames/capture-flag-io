// SPDX-License-Identifier: MIT
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { Filter } from 'bad-words';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { timeData, getRandomKeys } from './misc.js';
import { dirname } from 'path';
import stripJsonComments from 'strip-json-comments';
import { json } from 'stream/consumers';
import { exec } from 'child_process';
// filepath: /home/james/Documents/capture-flag-io/node/src/index.js
// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(dirname(__filename), '..');

// Initialize express app
const app = express();

// Create an HTTP server using express app
const server = http.createServer(app);

// Create a single Socket.IO server instance
const io = new Server(server, {
    cors: {
        origin: "http://localhost:4566",
        methods: ["GET", "POST"],
    },
});

let lobbyCount = 0;
const playerWidth = 25;
const playerHeight = 25;
const flagWidth = 25;
const flagHeight = 100;
const moveSpeed = 75;
const cameraWidth = 200;
const cameraHeight = 200;
const filter = new Filter();

const fieldWidth = 1000;
const fieldHeight = 500;

function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;
}

function checkCollisionPlayerFlag(player, flag) {
    return checkCollision(player.x, player.y, playerWidth, playerHeight, flag.x, flag.y, flagWidth, flagHeight);
}

function isProfane(something) {
    return filter.isProfane(something);
}

function censorProfanity(something) {
    return filter.clean(something);
}

function canMove(x, y) {
    return x >= 0 && x <= fieldWidth - playerWidth && y >= 0 && y <= fieldHeight - playerHeight;
}

function movePlayer(player, newX, newY) {
    if (canMove(newX, newY)) {
        player.x = newX;
        player.y = newY;
    }
}

// Check if the speed of the player is too high, kill if true
function checkSpeed(x, y, newx, newy, topSpeed = 425) {
    const dx = Math.abs(x - newx);
    const dy = Math.abs(y - newy);

    if (dx > topSpeed || dy > topSpeed) {
        return true;
    }

    return false;
}

// Middleware setup
app.use(express.static('public'));
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:8080', // Update to match your Flutter Web origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Origin', 'X-Requested-With', 'Accept'],
}));

// Custom route to override maps.json
app.get('/assets/maps.json', (req, res) => {
    fs.readFile(path.join(__dirname, 'public/assets/maps.jsonc'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading maps.json:', err);
            return res.status(500).send('Error reading maps.json');
        }

        const cleanedData = stripJsonComments(data);
        res.send(cleanedData);
    });
});

// Middleware to serve static files from the assets directory
// This must come AFTER the custom maps.json route
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Routes
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/script.js'));
});

app.get('/context-engine.mjs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/context-engine.mjs'));
});

app.get('/script/context-engine', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/context-engine.js'));
});

app.get('/script/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/game.js'));
});

app.get('/shell.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shell.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Socket.IO logic (in a class for hopeful scalability)
class GameServer {
    constructor(namespace, lobbynum) {
        this.io = namespace; // Use namespace for the lobby
        this.reds = 0;
        this.lobby = lobbynum
        this.blues = 0;
        this.count = 0; // Track the number of players in the lobby
        this.maintenance = false;
        this.timestamp = new timeData(5 * 60); // 5 minutes
        this.timerInterval = null;
        this.timerRunning = false;
        this.inOvertime = false; // Track if the game is in overtime
        this.game = {
            players: {},
            flags: {
                red: this.createFlag("red"),
                blue: this.createFlag("blue"),
            },
            messages: [],
            currentMap: "map1" // Default map
        };
    }

    startGameTimer() {
        // Clear any existing timer
        this.stopGameTimer();
        
        // Create a new timer that ticks every second
        this.timerInterval = setInterval(() => {
            // Only countdown if there are players
            if (this.count > 0) {
                // In overtime, we don't decrement time but check scores each tick
                if (this.inOvertime) {
                    // Check if scores are no longer tied
                    const { redScore, blueScore } = this.getTeamScores();
                    if (redScore !== blueScore) {
                        // Overtime ends when scores are different
                        this.handleGameOver();
                    } else {
                        // Still tied, continue overtime
                        this.io.emit('timerUpdate', "OVERTIME");
                    }
                } else {
                    // Normal time countdown
                    // Decrement by 1 second
                    this.timestamp.setSeconds(this.timestamp.seconds() - 1);
                    
                    // Emit the updated time to all clients
                    this.io.emit('timerUpdate', this.timestamp.string());
                    
                    // Check for game end condition
                    if (this.timestamp.seconds() <= 0) {
                        // Check if scores are tied for overtime
                        const { redScore, blueScore } = this.getTeamScores();
                        if (redScore === blueScore && redScore > 0) {
                            // Enter overtime
                            this.inOvertime = true;
                            this.io.emit('overtimeStarted', "Teams are tied! Game continues until one team scores.");
                            this.io.emit('timerUpdate', "OVERTIME");
                        } else {
                            // Game over - not tied or no points scored
                            this.handleGameOver();
                        }
                    }
                }
            }
        }, 1000); // Run every 1000ms (1 second)
        
        this.timerRunning = true;
    }
    
    stopGameTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRunning = false;
        this.inOvertime = false;
    }

    // Helper method to get team scores
    getTeamScores() {
        let redScore = 0;
        let blueScore = 0;
        
        Object.values(this.game.players).forEach(player => {
            if (player.team === "red") {
                redScore += player.score || 0;
            } else if (player.team === "blue") {
                blueScore += player.score || 0;
            }
        });
        
        return { redScore, blueScore };
    }

    handleGameOver() {
        this.maintenance = true; // So no players can join during map choosing
        this.stopGameTimer();
        // Get 3 random maps from maps.jsonc
        try {
            const jsonData = fs.readFileSync(path.join(__dirname, 'public/assets/maps.jsonc'), 'utf8');
            const cleanedData = stripJsonComments(jsonData);
            const maps = JSON.parse(cleanedData);
            const randomMaps = getRandomKeys(maps, 3);
            // Fix: Create a new array with the map names instead of trying to modify in place
            const mapNames = randomMaps.map(map => maps[map].name);
            console.log("Selected maps for voting:", mapNames);
            this.io.emit('gameOver', { winner: this.determineWinner(), teamwinner: this.determineTeamWinner(), maps: mapNames });
        } catch (error) {
            console.error("Error loading maps for game over:", error);
            // Fallback to an empty array if there's an error
            this.io.emit('gameOver', { winner: this.determineWinner(), teamwinner: this.determineTeamWinner(), maps: [] });
        }
        // Reset the game or handle end-of-game state
        this.timestamp.setSeconds(5 * 60); // Reset timer
        this.inOvertime = false;
    }

    determineWinner() {
        let winnername = "";
        let winnerscore = 0;
        Object.values(this.game.players).forEach((player) => {
            if (player.score > winnerscore) {
                winnerscore = player.score;
                winnername = player.name;
            }
        });
        return winnername;
    }

    determineTeamWinner() {
        // Get the total score of each team
        const { redScore, blueScore } = this.getTeamScores();
        
        // If scores are tied, determine winner based on number of players (fallback)
        if (redScore === blueScore) {
            return this.reds > this.blues ? "red" : "blue";
        }
        
        return redScore > blueScore ? "red" : "blue";
    }

    emitWithLogging(event, message, log = true) {
        if (log) {
            console.log(`Emitting event: ${event}, Message:`, message);
        }
        this.io.emit(event, message);
    }

    createFlag(team) {
        return {
            x: team === "red" ? 100 : 900,
            y: 250,
            color: team,
            team: team,
            capturedBy: "",
        };
    }

    createPlayer(name, id, team) {
        const flag = this.game.flags[team];
        return {
            id: id,
            name: name,
            x: Math.floor(Math.random() * 50) + (flag.x - 25),
            y: Math.floor(Math.random() * 50) + (flag.y - 25),
            color: team,
            score: 0,
            team: team,
            capture: false,
        };
    }

    changeMap(mapName) {
        if (mapName && typeof mapName === 'string') {
            this.game.currentMap = mapName;
            // Notify all clients about the map change
            this.io.emit('mapChange', JSON.stringify({ currentMap: mapName }));
            console.log(`Map changed to: ${mapName}`);
            this.maintenance = false;
            this.timestamp.setSeconds(5 * 60);
            this.startGameTimer();
        }
    }

    do() {
        this.io.on('connection', (socket) => {
            console.log(`A user connected to ${this.io.name}!`);

            socket.on('message', (msg) => {
                if (isProfane(msg)) {
                    msg = censorProfanity(msg);
                }
                this.game.messages.push(msg);
                // if the messages array is greater than 10, remove the oldest message
                if (this.game.messages.length > 10) {
                    this.game.messages.shift();
                }
                this.emitWithLogging('message', msg);
            });

            socket.on('name', (name) => {
                console.log('Name received: ', name);
                if (!name || name.trim() === "") {
                    console.log("Invalid name received.");
                    return;
                }
                const team = this.reds < this.blues ? "red" : "blue";
                team === "red" ? this.reds++ : this.blues++;

                // if the count was 0, start the game timer
                if (this.count === 0) {
                    this.timestamp.setSeconds(5 * 60); // Reset timer to full
                    this.startGameTimer();
                }

                const player = this.createPlayer(name, socket.id, team);
                this.game.players[name] = player;
                this.count++; // Increment player count
                console.log('Player added: ', player);

                this.emitWithLogging('newPlayer', JSON.stringify(player));
                
                socket.emit('gameState', JSON.stringify(this.game));
                console.log("gameState", this.game);
                console.log("flags", this.game.flags);
            });

            socket.on('kill', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const player = data?.name ? this.game.players[data.name] : undefined;
                if (player && data.killer) {
                    // Update killer's score if the killer is a player (not system)
                    const killer = Object.values(this.game.players).find(p => p.name === data.killer);
                    if (killer && data.killer !== "system") {
                        killer.score += (player.score !== 0 ? player.score : 1);
                        this.emitWithLogging('scoreUp', JSON.stringify({ player: killer.name, score: killer.score }));
                    }
                    
                    if (player.team === "red") {
                        this.reds--;
                    } else {
                        this.blues--;
                    }
                    this.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: data.killer }));

                    if (player.capture) {
                        const flag = this.game.flags[player.team];
                        flag.capturedBy = "";
                        flag.x = player.x;
                        flag.y = player.y;
                        this.emitWithLogging('flagDropped', JSON.stringify({ player: player.name, flag: player.team === "red" ? "blue" : "red" }));
                    }

                    // If no players left, reset the timer and stop it
                    if (this.count === 0) {
                        this.timestamp.setSeconds(5 * 60);
                        this.stopGameTimer();
                    }
                }
            });

            socket.on('move', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const player = data?.name ? this.game.players[data.name] : undefined;
                if (player) {
                    if (data.x !== undefined && data.y !== undefined) {
                        if (!checkSpeed(player.x, player.y, data.x, data.y)) {
                            movePlayer(player, data.x, data.y);
                        } else {
                            console.log("Player speed too high, killing player: ", player.name);
                            if (player.team === "red") {
                                this.reds--;
                            } else {
                                this.blues--;
                            }
                            this.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
                            delete this.game.players[player.name];
                        }
                    }

                    for (const name in this.game.players) {
                        const otherPlayer = this.game.players[name];
                        if (otherPlayer.id !== player.id && Math.abs(player.x - otherPlayer.x) < 20 && Math.abs(player.y - otherPlayer.y) < 20) {
                            // Update the killer's score based on the killed player's score
                            player.score += (otherPlayer.score !== 0 ? otherPlayer.score : 1);
                            this.emitWithLogging('scoreUp', JSON.stringify({ player: player.name, score: player.score }));
                            
                            delete this.game.players[name];
                            if (otherPlayer.team === "red") {
                                this.reds--;
                            } else {
                                this.blues--;
                            }
                            this.emitWithLogging('kill', JSON.stringify({ player: otherPlayer.name, killer: player.name }));

                            if (otherPlayer.capture) {
                                const flag = this.game.flags[player.team];
                                flag.capturedBy = "";
                                flag.x = player.x;
                                flag.y = player.y;
                                this.emitWithLogging('flagDropped', JSON.stringify({ player: otherPlayer.name, flag: otherPlayer.team }));
                            }
                        }
                    }

                    const flag = player.team === "red" ? this.game.flags.blue : this.game.flags.red;
                    if (!player.capture && Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 20) {
                        player.capture = true;
                        flag.capturedBy = player.name;
                        this.emitWithLogging('flagCaptured', JSON.stringify({ player: player.name, flag: flag.team }));
                    }

                    const ownFlag = this.game.flags[player.team];
                    if (!ownFlag.capturedBy && 
                        Math.abs(player.x - ownFlag.x) < 20 && 
                        Math.abs(player.y - ownFlag.y) < 20) {
                        ownFlag.x = player.team === "red" ? 100 : 900;
                        ownFlag.y = 250;
                        this.game.flags[player.team] = ownFlag;
                        this.emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: ownFlag.team }));
                        // this.emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: ownFlag.team, x: ownFlag.x, y: ownFlag.y }));
                    }

                    if (player.capture) {
                        this.emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: flag.team, x: player.x, y: player.y - flagHeight / 2 }));
                    }

                    if (player.capture && checkCollisionPlayerFlag(player, { x: flag.team === "red" ? 900 : 100, y: 250, width: flagWidth, height: flagHeight })) {
                        player.score++;
                        this.emitWithLogging('scoreUp', JSON.stringify({ player: player.name}));
                        player.capture = false;
                        flag.capturedBy = "";
                        flag.x = flag.team === "red" ? 100 : 900;
                        flag.y = 250;
                        this.emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: flag.team }));
                        // this.emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: ownFlag.team, x: ownFlag.x, y: ownFlag.y }))
                    }
                    this.io.emit('move', JSON.stringify(data));
                }
            });

            socket.on('disconnect', () => {
                console.log(`A user disconnected from ${this.io.name}`);
                const playerName = Object.keys(this.game.players).find(name => this.game.players[name].id === socket.id);
                if (playerName) {
                    const team = this.game.players[playerName].team;
                    team === "red" ? this.reds-- : this.blues--;
                    delete this.game.players[playerName];
                    this.count--; // Decrement player count
                    this.emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
                    
                    // If no players left, reset the timer and stop it
                    if (this.count === 0) {
                        this.timestamp.setSeconds(5 * 60);
                        this.stopGameTimer();
                    }
                }
            });

            // Add a map change handler
            socket.on('changeMap', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                
                if (data.mapName) {
                    this.changeMap(data.mapName);
                }
            });
        });
    }

    // New method to manually trigger game over (for admin commands)
    forceGameOver() {
        console.log(`Forcing game over for lobby ${this.lobby}`);
        this.handleGameOver();
        return true;
    }
}

// Initialize namespaces for lobbies
const lobbies = [
    { path: '/lobby1', server: null },
    { path: '/lobby2', server: null },
];

lobbies.forEach((lobby) => {
    const namespace = io.of(lobby.path); // Use the single `io` instance
    lobby.server = new GameServer(namespace, lobbyCount++);
    lobby.server.do();
});

// REST APIs
app.get('/lobby', (req, res) => {
    const availableLobby = lobbies.find(lobby => lobby.server.count < 10 && !lobby.server.maintenance);
    if (availableLobby) {
        return res.json({ path: availableLobby.path });
    } else {
        return res.status(503).json({ message: 'All lobbies are full' });
    }
});

app.get('/check-name', (req, res) => {
    const name  = String(req.query.name || "");
    const lobby = String(req.query.lobby || "");

    const lobbyObj = lobbies.find(l => l.path === lobby);
    if (!lobbyObj) return res.status(404).json({ available: false });

    const taken = Boolean(lobbyObj.server.game.players[name]);
    if (taken || isProfane(name)) return res.json({ available: false });

    return res.json({ available: true });
});

// Add stdin command handling
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const command = input.trim();
    if (command.startsWith('game')) {
        const parts = command.split(' ');
        if (parts.length === 2) {
            const lobbyNumber = parseInt(parts[1], 10);
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    console.log(`Game state for lobby ${lobbyNumber}:`);
                    console.log(JSON.stringify(lobby.server.game, null, 2)); // Pretty print game state
                } else {
                    console.log(`Lobby ${lobbyNumber} does not exist or is not initialized.`);
                }
            } else {
                console.log('Invalid lobby number. Usage: game <lobby_number>');
            }
        } else {
            console.log('Invalid command format. Usage: game <lobby_number>');
        }
    } else if (command.startsWith('kill')) {
        // ex: kill 1 "bob"
        const parts = command.split(' ');
        
        if (parts.length === 3) {
            const lobbyNumber = parseInt(parts[1], 10);
            const playerName = parts[2].replace(/"/g, '');
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    const player = lobby.server.game.players[playerName];
                    if (player) {
                        console.log(`Killing player ${playerName} in lobby ${lobbyNumber}`);
                        delete lobby.server.game.players[playerName];
                        this.emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
                    } else {
                        console.log(`Player ${playerName} not found in lobby ${lobbyNumber}`);
                    }
                } else {
                    console.log(`Lobby ${lobbyNumber} does not exist or is not initialized.`);
                }
            } else {
                console.log('Invalid lobby number. Usage: kill <lobby_number> <player_name>');
            }
        } else {
            console.log('Invalid command format. Usage: kill <lobby_number> <player_name>');
        }
    } else if (command.startsWith('skip_round')) {
        const parts = command.split(' ');
        
        if (parts.length === 2) {
            const lobbyNumber = parseInt(parts[1], 10);
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    const success = lobby.server.forceGameOver();
                    if (success) {
                        console.log(`Round skipped for lobby ${lobbyNumber}. Voting phase initiated.`);
                    } else {
                        console.log(`Failed to skip round for lobby ${lobbyNumber}.`);
                    }
                } else {
                    console.log(`Lobby ${lobbyNumber} does not exist or is not initialized.`);
                }
            } else {
                console.log('Invalid lobby number. Usage: skip_round <lobby_number>');
            }
        } else {
            console.log('Invalid command format. Usage: skip_round <lobby_number>');
        }
    } else if (command.trim() === 'exit') {
        console.log('Exiting server...');
        // emit a kill event to all players
        lobbies.forEach((lobby) => {
            Object.values(lobby.server.game.players).forEach((player) => {
                this.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
            });
        });
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
    } else if (command.trim() === 'clear') {
        console.clear();
        exec('reset');
    } else {
        console.log('Unknown command. Available commands: ');
        console.log('game <lobby_number> - Pretty-prints the GameState of the lobby number.');
        console.log('kill <lobby_number> <player_name> - Kills the player in the specified lobby.');
        console.log('skip_round <lobby_number> - Skips the current round and starts voting phase.');
        console.log('');
        console.log('Available lobbies:');
        lobbies.forEach((lobby, index) => {
            console.log(`Lobby ${index + 1}: ${lobby.path}`);
        });
        console.log('Type "exit" to quit the server.');
    }
});

const PORT = process.env.PORT || 4566;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    lobbies.forEach((lobby) => {
        console.log(`Lobby available at ws://localhost:${PORT}${lobby.path}`);
    });
});
