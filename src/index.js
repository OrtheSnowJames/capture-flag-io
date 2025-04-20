// SPDX-License-Identifier: MIT
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { profanity } from '@2toad/profanity';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { json } from 'stream/consumers';
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
        origin: "http://localhost:34989", // Replace with your client origin
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
    return profanity.exists(something);
}

function censorProfanity(something) {
    return profanity.censor(something);
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
function checkSpeed(x, y, newx, newy, topSpeed = 400) {
    const dx = Math.abs(x - newx);
    const dy = Math.abs(y - newy);

    if (dx > topSpeed || dy > topSpeed) {
        return true;
    }

    return false;
}

function emitWithLogging(event, message, log = true) {
    if (log) {
        console.log(`Emitting event: ${event}, Message:`, message);
    }
    io.emit(event, message);
}

// Middleware setup
app.use(express.static('public'));
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:8080', // Update to match your Flutter Web origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Origin', 'X-Requested-With', 'Accept'],
}));

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

app.get('/assets/redflag.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/assets/redflag.png'));
})

app.get('/assets/blueflag.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/assets/blueflag.png'));
});

app.get('/assets/coverart.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/assets/coverart.png'));
})

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
        this.game = {
            players: {},
            flags: {
                red: this.createFlag("red"),
                blue: this.createFlag("blue"),
            },
            messages: [],
        };
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

    do() {
        this.io.on('connection', (socket) => {
            console.log(`A user connected to ${this.io.name}!`);

            socket.on('message', (msg) => {
                if (isProfane(msg)) {
                    msg = censorProfanity(msg);
                }
                this.game.messages.push(msg);
                emitWithLogging('message', msg);
            });

            socket.on('name', (name) => {
                console.log('Name received: ', name);
                if (!name || name.trim() === "") {
                    console.log("Invalid name received.");
                    return;
                }
                const team = this.reds < this.blues ? "red" : "blue";
                team === "red" ? this.reds++ : this.blues++;

                const player = this.createPlayer(name, socket.id, team);
                this.game.players[name] = player;
                this.count++; // Increment player count
                console.log('Player added: ', player);

                emitWithLogging('gameState', JSON.stringify(this.game));
                emitWithLogging('newPlayer', JSON.stringify(player));
                console.log("flags", this.game.flags);
            });

            socket.on('kill', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const player = data?.name ? this.game.players[data.name] : undefined;
                if (player && data.killer) {
                    emitWithLogging('kill', JSON.stringify({ player: player.name, killer: data.killer }));

                    if (player.capture) {
                        const flag = this.game.flags[player.team];
                        flag.capturedBy = "";
                        flag.x = player.x;
                        flag.y = player.y;
                        emitWithLogging('flagDropped', JSON.stringify({ player: player.name, flag: player.team === "red" ? "blue" : "red" }));
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
                            emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
                            delete this.game.players[player.name];
                        }
                    }

                    for (const name in this.game.players) {
                        const otherPlayer = this.game.players[name];
                        if (otherPlayer.id !== player.id && Math.abs(player.x - otherPlayer.x) < 20 && Math.abs(player.y - otherPlayer.y) < 20) {
                            delete this.game.players[name];
                            emitWithLogging('kill', JSON.stringify({ player: otherPlayer.name, killer: player.name }));
                            otherPlayer.team === "red" ? this.reds-- : this.blues--;

                            if (otherPlayer.capture) {
                                const flag = this.game.flags[player.team];
                                flag.capturedBy = "";
                                flag.x = player.x;
                                flag.y = player.y;
                                emitWithLogging('flagDropped', JSON.stringify({ player: otherPlayer.name, flag: otherPlayer.team }));
                            }
                        }
                    }

                    const flag = player.team === "red" ? this.game.flags.blue : this.game.flags.red;
                    if (!player.capture && Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 20) {
                        player.capture = true;
                        flag.capturedBy = player.name;
                        emitWithLogging('flagCaptured', JSON.stringify({ player: player.name, flag: flag.team }));
                    }

                    const ownFlag = this.game.flags[player.team];
                    if (!ownFlag.capturedBy && 
                        Math.abs(player.x - ownFlag.x) < 20 && 
                        Math.abs(player.y - ownFlag.y) < 20) {
                        ownFlag.x = player.team === "red" ? 100 : 900;
                        ownFlag.y = 250;
                        this.game.flags[player.team] = ownFlag;
                        emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: ownFlag.team }));
                        emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: ownFlag.team, x: ownFlag.x, y: ownFlag.y }));
                    }

                    if (player.capture) {
                        emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: flag.team, x: player.x, y: player.y - flagHeight / 2 }));
                    }

                    if (player.capture && checkCollisionPlayerFlag(player, { x: flag.team === "red" ? 900 : 100, y: 250, width: flagWidth, height: flagHeight })) {
                        player.score++;
                        emitWithLogging('scoreUp', JSON.stringify({ player: player.name}));
                        player.capture = false;
                        flag.capturedBy = "";
                        flag.x = flag.team === "red" ? 100 : 900;
                        flag.y = 250;
                        emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: flag.team }));
                        emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: ownFlag.team, x: ownFlag.x, y: ownFlag.y }))
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
                    emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
                }
            });
        });
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

// function to get which lobby to go to
app.get('/lobby', (req, res) => {
    const availableLobby = lobbies.find(lobby => lobby.server.count < 10);
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
                        emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
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
    } else if (command.trim() === 'exit') {
        console.log('Exiting server...');
        // emit a kill event to all players
        lobbies.forEach((lobby) => {
            Object.values(lobby.server.game.players).forEach((player) => {
                emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
            });
        });
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
    } else {
        console.log('Unknown command. Available commands: ');
        console.log('game <lobby_number> - Pretty-prints the GameState of the lobby number.');
        console.log('kill <lobby_number> <player_name> - Kills the player in the specified lobby.');
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
