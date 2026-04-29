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

function Task(fn) {
    (async () => {
        await fn();
    })();
}

let lobbyCount = 0;
let nextLobbyId = 1;
let appOk = true;
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
const grenadeThrowSpeed = 400;
const grenadeSmokeDurationMs = 10000;
const grenadePickupRadius = 30;
const grenadeSpawnPerBase = 3;
const fragGrenadeSpawnPerBase = 2;
const fragKillRadius = 45;
const explosionDurationMs = 1000;
const grenadeProjectileRadius = 8;
const grenadeMinSpawnDistance = 60;

function checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;
}

function distanceSquaredPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
        const sx = px - x1;
        const sy = py - y1;
        return sx * sx + sy * sy;
    }
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const cx = x1 + clamped * dx;
    const cy = y1 + clamped * dy;
    const ddx = px - cx;
    const ddy = py - cy;
    return ddx * ddx + ddy * ddy;
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
    origin: 'http://localhost:4566', 
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

app.get('/globals.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/globals.js'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets/favicon.ico'));
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

app.get('/feedback', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/feedback.html'));
});

app.get('/api/music-tracks', (req, res) => {
    try {
        const musicDir = path.join(__dirname, 'public/assets/music');
        const allowedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
        const tracks = fs.readdirSync(musicDir)
            .filter(file => allowedExtensions.has(path.extname(file).toLowerCase()))
            .sort((a, b) => a.localeCompare(b))
            .map(file => `/assets/music/${file}`);
        res.json({ tracks });
    } catch (error) {
        console.error('Error reading music tracks:', error);
        res.status(500).json({ tracks: [] });
    }
});

// Non-game rest apis
app.get('/api/submit-feedback', (req, res) => {
    const { feedback } = req.query;

    // Get the feedback file
    const feedbackFile = path.join(__dirname, 'public/assets/feedback.txt');

    // Append the feedback to the file
    fs.appendFile(feedbackFile, feedback + '\n ' + new Date().toISOString() + '\n' + '\n', (err) => {
        if (err) {
            console.error('Error appending feedback:', err);
            return res.status(500).json({ error: 'Failed to submit feedback' });
        }
    });


    res.json({ success: true });
});


// Socket.IO logic (in a class for hopeful scalability)
class GameServer {
    constructor(namespace, lobbynum) {
        this.io = namespace; // Use namespace for the lobby
        this.reds = 0;
        this.lobby = lobbynum
        this.highscore = 0;
        this.blues = 0;
        this.count = 0; // Track the number of players in the lobby
        this.maintenance = false;
        this.timestamp = new timeData(5 * 60); // 5 minutes
        this.timerInterval = null;
        this.timerRunning = false;
        this.inOvertime = false; // Track if the game is in overtime
        this.ops = new Set(); // Track op players
        this.private = false;
        this.reqDelete = false;
        this.socketMeta = new Map();
        this.items = [];
        this.projectiles = [];
        this.smokeClouds = [];
        this.explosions = [];
        this.nextItemId = 1;
        this.nextProjectileId = 1;
        this.nextSmokeId = 1;
        this.nextExplosionId = 1;
        this.lastWorldTick = Date.now();
        this.worldInterval = null;
        this.game = {
            players: {},
            flags: {
                red: this.createFlag("red"),
                blue: this.createFlag("blue"),
            },
            messages: [],
            currentMap: "map1" // Default map
        };
        this.spawnGrenades();
        this.startWorldLoop();
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

    kickPlayer(playerName) {
        if (this.game.players[playerName]) {
            const socketId = this.game.players[playerName].id;
            if (this.game.players[playerName].team === "red") {
                this.reds--;
            } else {
                this.blues--;
            }
            delete this.game.players[playerName];
            this.count--;
            this.emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
            if (socketId) {
                this.io.to(socketId).emit('kicked');
            }
        }
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
            color: this.ops.has(name) ? "yellow" : team,
            score: 0,
            team: team,
            capture: false,
            skin: 0 // Default skin (no skin)
        };
    }

    spawnGrenade(baseX, baseY, type = "smoke") {
        let x = baseX;
        let y = baseY;
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = grenadeMinSpawnDistance + Math.random() * 80;
            x = Math.min(fieldWidth - 10, Math.max(10, baseX + Math.cos(angle) * radius));
            y = Math.min(fieldHeight - 10, Math.max(10, baseY + Math.sin(angle) * radius));
            const dx = x - baseX;
            const dy = y - baseY;
            if (Math.hypot(dx, dy) >= grenadeMinSpawnDistance) {
                break;
            }
        }
        this.items.push({
            id: this.nextItemId++,
            type,
            x,
            y,
            state: "ground",
            heldBy: null,
            orbitAngle: 0
        });
    }

    spawnGrenades() {
        this.items = [];
        for (let i = 0; i < grenadeSpawnPerBase; i++) {
            this.spawnGrenade(this.game.flags.red.x, this.game.flags.red.y, "smoke");
            this.spawnGrenade(this.game.flags.blue.x, this.game.flags.blue.y, "smoke");
        }
        for (let i = 0; i < fragGrenadeSpawnPerBase; i++) {
            this.spawnGrenade(this.game.flags.red.x, this.game.flags.red.y, "frag");
            this.spawnGrenade(this.game.flags.blue.x, this.game.flags.blue.y, "frag");
        }
    }

    startWorldLoop() {
        if (this.worldInterval) return;
        this.lastWorldTick = Date.now();
        this.worldInterval = setInterval(() => {
            const now = Date.now();
            const deltaMs = now - this.lastWorldTick;
            this.lastWorldTick = now;
            this.updateWorld(deltaMs);
        }, 50);
    }

    updateWorld(deltaMs) {
        const deltaSec = deltaMs / 1000;

        if (this.projectiles.length > 0) {
            const remaining = [];
            for (const projectile of this.projectiles) {
                const prevX = projectile.x;
                const prevY = projectile.y;
                projectile.x += projectile.vx * deltaSec;
                projectile.y += projectile.vy * deltaSec;

                let detonated = false;
                for (const player of Object.values(this.game.players)) {
                    if (!player) continue;
                    const hit = checkCollision(
                        projectile.x - grenadeProjectileRadius,
                        projectile.y - grenadeProjectileRadius,
                        grenadeProjectileRadius * 2,
                        grenadeProjectileRadius * 2,
                        player.x,
                        player.y,
                        playerWidth,
                        playerHeight
                    );
                    if (hit) {
                        detonated = true;
                        projectile.x = player.x;
                        projectile.y = player.y;
                        break;
                    }
                }
                if (projectile.x < 0 || projectile.x > fieldWidth || projectile.y < 0 || projectile.y > fieldHeight) {
                    detonated = true;
                } else {
                    const hasTarget = typeof projectile.targetX === "number" && typeof projectile.targetY === "number";
                    if (hasTarget) {
                        const distanceSquared = distanceSquaredPointToSegment(
                            projectile.targetX,
                            projectile.targetY,
                            prevX,
                            prevY,
                            projectile.x,
                            projectile.y
                        );
                        if (distanceSquared <= 100) {
                            detonated = true;
                            projectile.x = projectile.targetX;
                            projectile.y = projectile.targetY;
                        }
                    }
                }

                if (detonated) {
                    this.detonateProjectile(projectile, projectile.x, projectile.y);
                } else {
                    remaining.push(projectile);
                }
            }
            this.projectiles = remaining;
        }

        if (this.smokeClouds.length > 0) {
            const now = Date.now();
            this.smokeClouds = this.smokeClouds.filter(cloud => cloud.expiresAt > now);
        }
        if (this.explosions.length > 0) {
            const now = Date.now();
            this.explosions = this.explosions.filter(explosion => explosion.expiresAt > now);
        }

        this.emitWorldState(false);
    }

    emitWorldState(log = false) {
        this.emitWithLogging('worldUpdate', JSON.stringify({
            items: this.items,
            projectiles: this.projectiles,
            smokeClouds: this.smokeClouds,
            explosions: this.explosions
        }), log);
    }

    detonateProjectile(projectile, x, y) {
        console.log(
            `[DBG][detonate] lobby=${this.lobby} type=${projectile.type} owner=${projectile.owner || "system"} x=${x.toFixed(1)} y=${y.toFixed(1)} players=${Object.keys(this.game.players).length}`
        );
        if (projectile.type === "frag") {
            this.explosions.push({
                id: this.nextExplosionId++,
                x,
                y,
                expiresAt: Date.now() + explosionDurationMs
            });

            Object.values(this.game.players).forEach(player => {
                const dx = player.x - x;
                const dy = player.y - y;
                const distance = Math.hypot(dx, dy);
                if (distance <= fragKillRadius) {
                    console.log(
                        `[DBG][frag-hit] lobby=${this.lobby} victim=${player.name} owner=${projectile.owner || "system"} distance=${distance.toFixed(2)}`
                    );
                    this.dropHeldItems(player);
                    this.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: projectile.owner || "system" }));
                    if (player.capture) {
                        const flag = this.game.flags[player.team];
                        flag.capturedBy = "";
                        flag.x = player.x;
                        flag.y = player.y;
                        this.emitWithLogging('flagDropped', JSON.stringify({ player: player.name, flag: player.team === "red" ? "blue" : "red" }));
                    }
                    if (player.team === "red") {
                        this.reds--;
                    } else {
                        this.blues--;
                    }
                    delete this.game.players[player.name];
                    this.count = Math.max(0, this.count - 1);
                    console.log(
                        `[DBG][frag-kill] lobby=${this.lobby} victim=${player.name} deleted=true count=${this.count}`
                    );
                }
            });
        } else {
            this.smokeClouds.push({
                id: this.nextSmokeId++,
                x,
                y,
                expiresAt: Date.now() + grenadeSmokeDurationMs
            });
        }

        setTimeout(() => {
            const base = Math.random() < 0.5 ? this.game.flags.red : this.game.flags.blue;
            this.spawnGrenade(base.x, base.y, projectile.type || "smoke");
            this.emitWorldState(false);
        }, 2000);
    }

    dropHeldItems(player) {
        if (!player) return;
        this.items.forEach(item => {
            if (item.state === "held" && item.heldBy === player.name) {
                item.state = "ground";
                item.heldBy = null;
                item.x = player.x;
                item.y = player.y;
            }
        });
    }

    changeMap(mapName) {
        if (mapName && typeof mapName === 'string') {
            this.game.currentMap = mapName;
            // Notify all clients about the map change
            this.io.emit('mapChange', JSON.stringify({ currentMap: mapName }));
            console.log(`Map changed to: ${mapName}`);
            this.maintenance = false;
            this.timestamp.setSeconds(5 * 60);
            this.spawnGrenades();
            this.emitWorldState(false);
            this.startGameTimer();
        }
    }

    do() {
        this.io.on('connection', (socket) => {
            console.log(`A user connected to ${this.io.name}`);

            socket.on('message', (msg) => {
                const player = this.game.players[msg.split(" said ")[0]];
                if (this.ops.has(player.name) && msg.split(" said ")[1].startsWith("!op")) {
                    console.log("Operator command received: " + msg);
                    // get the part after !op so like !op kick bob = kick bob
                    const command = msg.split("!op")[1].trim();
                    // parse message
                    if (command.startsWith("kick")) {
                        this.kickPlayer(command.split(" ")[1]);
                        console.log("Kicked player: " + command.split(" ")[1]);
                    } else if (command.startsWith("maintenance")) {
                        this.maintenance = true;
                    } else if (command.startsWith("clear")) {
                        console.clear();
                        exec('reset');
                    } else if (command.startsWith("exec")) {
                        exec(command.split(" ")[1]);
                    } else if (command.startsWith("map")) {
                        this.changeMap(command.split("exec ")[1]);
                    } else if (command.startsWith("highscore")) {
                        this.game.messages.push("[System.Log] says Highscore: " + this.highscore);
                        this.emitWithLogging('message', "[System.Log] says Highscore: " + this.highscore);
                    } else if (command.startsWith("announce")) {
                        // get message to announce
                        // get all to the right of announce
                        const message = command.split("announce")[1];
                        this.io.emit('announce', message);
                        console.log("Announced: " + message);
                    } else if (command.startsWith("skin")) {
                        // Format: !op skin [playerName] [skinId]
                        const parts = command.split(" ");
                        if (parts.length >= 3) {
                            const targetPlayer = parts[1];
                            const skinId = parseInt(parts[2]);
                            
                            if (targetPlayer && this.game.players[targetPlayer] && !isNaN(skinId) && skinId >= 0) {
                                this.game.players[targetPlayer].skin = skinId;
                                this.io.emit("skinChange", JSON.stringify({ player: targetPlayer, skin: skinId }));
                                console.log(`Changed skin for player ${targetPlayer} to ${skinId}`);
                            }
                        }
                    }
                } else {
                    if (isProfane(msg)) {
                        msg = censorProfanity(msg);
                    }
                    this.game.messages.push(msg);
                    // if the messages array is greater than 10, remove the oldest message
                    if (this.game.messages.length > 10) {
                        this.game.messages.shift();
                    }
    
                    // the name of the player who sent the message is in [player] said [msg]
                    if (player) {
                        this.emitWithLogging('message', msg);
                    }    
                }
            });

            socket.on('name', (name) => {
                console.log('Name received: ', name);
                if (!name || name.trim() === "") {
                    console.log("Invalid name received.");
                    return;
                }
                const team = this.reds < this.blues ? "red" : "blue";
                team === "red" ? this.reds++ : this.blues++;
                this.socketMeta.set(socket.id, { name, team });

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
                
                Object.values(this.game.players).forEach(player => {
                    if (this.ops.has(player.name)) {
                        player.isOp = true;
                    } else {
                        player.isOp = false;
                    }
                });

                socket.emit('gameState', JSON.stringify({
                    ...this.game,
                    items: this.items,
                    projectiles: this.projectiles,
                    smokeClouds: this.smokeClouds,
                    explosions: this.explosions
                }));
                console.log("gameState", this.game);
                console.log("flags", this.game.flags);
            });

            socket.on('kill', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const player = data?.name ? this.game.players[data.name] : undefined;
                // Check if the killer is an operator
                if (player && data.killer && this.ops.has(data.killer)) {
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
                    this.dropHeldItems(player);
                    delete this.game.players[player.name];

                    // If no players left, reset the timer and stop it
                    if (this.count === 0) {
                        this.timestamp.setSeconds(5 * 60);
                        this.stopGameTimer();
                    }
                }
            });

            socket.on('respawn', () => {
                const meta = this.socketMeta.get(socket.id);
                if (!meta || !meta.name || !meta.team) return;

                const { name, team } = meta;
                if (this.game.players[name]) return;

                const player = this.createPlayer(name, socket.id, team);
                this.game.players[name] = player;
                team === "red" ? this.reds++ : this.blues++;

                this.emitWithLogging('newPlayer', JSON.stringify(player));

                Object.values(this.game.players).forEach(player => {
                    if (this.ops.has(player.name)) {
                        player.isOp = true;
                    } else {
                        player.isOp = false;
                    }
                });

                socket.emit('gameState', JSON.stringify({
                    ...this.game,
                    items: this.items,
                    projectiles: this.projectiles,
                    smokeClouds: this.smokeClouds,
                    explosions: this.explosions
                }));
            });

            socket.on('itemPickup', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const meta = this.socketMeta.get(socket.id);
                if (!meta || !meta.name) return;
                const player = this.game.players[meta.name];
                if (!player) return;

                if (this.items.some(it => it.state === "held" && it.heldBy === meta.name)) {
                    return;
                }

                const item = this.items.find(it => it.id === data.itemId);
                if (!item || item.state !== "ground") return;

                const dx = item.x - player.x;
                const dy = item.y - player.y;
                if (Math.hypot(dx, dy) > grenadePickupRadius) return;

                item.state = "held";
                item.heldBy = meta.name;
                item.orbitAngle = 0;

                this.emitWorldState(false);
            });

            socket.on('itemOrbit', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const meta = this.socketMeta.get(socket.id);
                if (!meta || !meta.name) return;
                const item = this.items.find(it => it.id === data.itemId);
                if (!item || item.state !== "held" || item.heldBy !== meta.name) return;

                if (typeof data.angle === "number") {
                    item.orbitAngle = data.angle;
                    this.emitWorldState(false);
                }
            });

            socket.on('itemThrow', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const meta = this.socketMeta.get(socket.id);
                if (!meta || !meta.name) return;
                const player = this.game.players[meta.name];
                if (!player) return;

                const itemIndex = this.items.findIndex(it => it.id === data.itemId);
                if (itemIndex === -1) return;
                const item = this.items[itemIndex];
                if (item.state !== "held" || item.heldBy !== meta.name) return;

                const dx = data.targetX - player.x;
                const dy = data.targetY - player.y;
                const dist = Math.max(1, Math.hypot(dx, dy));
                const vx = (dx / dist) * grenadeThrowSpeed;
                const vy = (dy / dist) * grenadeThrowSpeed;

                this.projectiles.push({
                    id: this.nextProjectileId++,
                    clientId: data.clientId ?? null,
                    type: item.type,
                    owner: meta.name,
                    x: player.x,
                    y: player.y,
                    vx,
                    vy,
                    targetX: data.targetX,
                    targetY: data.targetY
                });

                this.items.splice(itemIndex, 1);
                this.emitWorldState(false);
            });

            socket.on('itemDetonate', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const projectileIndex = this.projectiles.findIndex(proj => proj.id === data.projectileId);
                if (projectileIndex === -1) return;
                const projectile = this.projectiles[projectileIndex];
                this.projectiles.splice(projectileIndex, 1);
                this.detonateProjectile(projectile, data.x ?? projectile.x, data.y ?? projectile.y);
                this.emitWorldState(false);
            });

            socket.on('move', (data) => {
                if (typeof data === 'string') data = JSON.parse(data);
                const player = data?.name ? this.game.players[data.name] : undefined;
                if (player) {
                    if (data.x !== undefined && data.y !== undefined) {
                        if (!checkSpeed(player.x, player.y, data.x, data.y)) {
                            movePlayer(player, data.x, data.y);
                        } else if (!this.ops.has(player.name)) {
                            console.log("Player speed too high, killing player: ", player.name);
                            if (player.team === "red") {
                                this.reds--;
                            } else {
                                this.blues--;
                            }
                            this.dropHeldItems(player);
                            this.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
                            delete this.game.players[player.name];
                        }
                    }

                    for (const name in this.game.players) {
                        const otherPlayer = this.game.players[name];
                        if ((otherPlayer.id !== player.id && Math.abs(player.x - otherPlayer.x) < 20 && Math.abs(player.y - otherPlayer.y) < 20) && !this.ops.has(otherPlayer.name)) {
                            // Update the killer's score based on the killed player's score
                            player.score += (otherPlayer.score !== 0 ? otherPlayer.score : 1);
                            this.emitWithLogging('scoreUp', JSON.stringify({ player: player.name, score: player.score }));
                            
                            this.dropHeldItems(otherPlayer);
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
                    if (ownFlag.capturedBy && 
                        Math.abs(player.x - ownFlag.x) < 20 && 
                        Math.abs(player.y - ownFlag.y) < 20) {
                        ownFlag.x = player.team === "red" ? 100 : 900;
                        ownFlag.y = 250;
                        this.game.flags[player.team] = ownFlag;
                        this.emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: ownFlag.team }));
                    }

                    if (player.capture) {
                        this.io.emit('flagMoved', JSON.stringify({ player: player.name, flag: flag.team, x: player.x, y: player.y - flagHeight / 2 }));
                    }

                    if (player.capture && checkCollisionPlayerFlag(player, { x: flag.team === "red" ? 900 : 100, y: 250, width: flagWidth, height: flagHeight })) {
                        player.score++;
                        this.emitWithLogging('scoreUp', JSON.stringify({ player: player.name}));
                        player.capture = false;
                        flag.capturedBy = "";
                        flag.x = flag.team === "red" ? 100 : 900;
                        flag.y = 250;
                        this.emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: flag.team, scoredBy: player.name }));
                    }
                    this.io.emit('move', JSON.stringify(data));
                } else if (data?.name) {
                    const meta = this.socketMeta.get(socket.id);
                    console.log(
                        `[DBG][move-missing-player] lobby=${this.lobby} socket=${socket.id} metaName=${meta?.name || "none"} packetName=${data.name}`
                    );
                }
            });

            socket.on('disconnect', () => {
                console.log(`A user disconnected from ${this.io.name}`);
                this.socketMeta.delete(socket.id);
                const playerName = Object.keys(this.game.players).find(name => this.game.players[name].id === socket.id);
                if (playerName) {
                    this.dropHeldItems(this.game.players[playerName]);
                    const team = this.game.players[playerName].team;
                    team === "red" ? this.reds-- : this.blues--;

                    if (this.game.players[playerName].score > this.highscore) {
                        this.highscore = this.game.players[playerName].score;
                        this.game.messages.push("[System.Log] says New Highscore: " + this.highscore + " from " + playerName);
                        this.emitWithLogging('message', "[System.Log] says New Highscore: " + this.highscore, "from " + playerName);
                    }

                    // Remove player from ops set if they were an operator
                    this.ops.delete(playerName);
                    delete this.game.players[playerName];
                    this.count--; // Decrement player count
                    console.log(`count: ${this.count}`)
                    this.emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
                    
                    // If no players left, reset the timer and stop it
                    if (this.count === 0 && !this.private) {
                        this.timestamp.setSeconds(5 * 60);
                        this.stopGameTimer();
                    } else if (this.count === 0 && this.private) {
                        // destroy the lobby
                        this.maintenance = true;
                        this.reqDelete = true;
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

    shutdown() {
        this.stopGameTimer();
        if (this.worldInterval) {
            clearInterval(this.worldInterval);
            this.worldInterval = null;
        }
        this.io.disconnectSockets(true);
    }
}

function configureLobby(lobby, privatee = false) {
    const namespace = io.of(lobby.path); // Use the single `io` instance
    lobby.server = new GameServer(namespace, lobbyCount++);
    lobby.server.do();
    lobby.server.private = privatee;
}

function createPublicLobby() {
    const lobby = { path: `/lobby${nextLobbyId++}`, server: null };
    configureLobby(lobby);
    lobbies.push(lobby);
    return lobby;
}

function cleanupEmptyPublicLobbies() {
    for (let i = lobbies.length - 1; i >= 0; i--) {
        const lobby = lobbies[i];
        const hasNoSockets = lobby.server && lobby.server.io && lobby.server.io.sockets && lobby.server.io.sockets.size === 0;
        if (lobby.server && lobby.server.count === 0 && hasNoSockets && typeof lobby.privcode === 'undefined') {
            lobby.server.shutdown();
            lobbies.splice(i, 1);
        }
    }
}

// Initialize namespaces for lobbies
const lobbies = [];
createPublicLobby();
createPublicLobby();

const lobbyCleanupInterval = setInterval(() => {
    cleanupEmptyPublicLobbies();
}, 30000);

// REST APIs
app.get('/lobby', (req, res) => {
    cleanupEmptyPublicLobbies();
    // go through lobbies and check if any are reqDelete
    for (let i = lobbies.length - 1; i >= 0; i--) {
        if (lobbies[i].server.reqDelete) {
            lobbies[i].server.shutdown();
            lobbies.splice(i, 1);
        }
    }

    const availableLobby = lobbies.find(lobby => lobby.server.count < 10 && !lobby.server.maintenance && typeof lobby.privcode === 'undefined');
    if (availableLobby) {
        return res.json({ path: availableLobby.path });
    } else {
        const newLobby = createPublicLobby();
        return res.json({ path: newLobby.path });
    }
});

app.get('/check-name', (req, res) => {
    const name  = String(req.query.name || "");
    const lobby = String(req.query.lobby || "");

    const lobbyObj = lobbies.find(l => l.path === lobby);
    if (!lobbyObj) return res.status(404).json({ available: false });

    // Check if name contains spaces
    if (name.includes(' ')) return res.json({ available: false, reason: 'Names cannot contain spaces' });

    const taken = Boolean(lobbyObj.server.game.players[name]);
    if (taken || isProfane(name)) return res.json({ available: false });

    return res.json({ available: true });
});

app.get('/lobby/newlobby', (req, res) => {
    const lobby = { path: `/lobby${nextLobbyId++}`, server: null, privcode: Math.random().toString(36).substring(2, 15) };
    configureLobby(lobby, true);
    lobbies.push(lobby);
    res.json({ path: lobby.path, privcode: lobby.privcode }); // privcode will be used to configure the lobby
});

app.get('/lobby/deletelobby', (req, res) => {
    const path = req.query.path;
    const privcode = req.query.privcode;
    const lobby = lobbies.find(l => l.path === path);
    if (lobby && typeof lobby.privcode !== 'undefined') {
        if (lobby.privcode === privcode) {
            lobby.server.shutdown();
            lobbies.splice(lobbies.indexOf(lobby), 1);
            return res.json({ message: 'Lobby deleted' });
        } else {
            return res.status(401).json({ message: 'Invalid private code' });
        }
    } else {
        return res.status(404).json({ message: 'Lobby not found' });
    }
});

app.get('/healthz', (req, res) => {
    if (appOk) {
        res.status(200).send('OK');
    } else {
        res.status(500).send('NOT OK');
    }
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
        shutdownServer('stdin exit');
    } else if (command.trim() === 'clear') {
        console.clear();
        exec('reset');
    } else if (command.startsWith('kick')) {
        // ex: kick 1 "bob"
        const parts = command.split(' ');
        if (parts.length === 3) {
            const lobbyNumber = parseInt(parts[1], 10);
            const playerName = parts[2].replace(/"/g, '');
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    lobby.server.kickPlayer(playerName);
                    console.log(`Kicked player ${playerName} from lobby ${lobbyNumber}`);
                }
            } else {
                console.log('Invalid lobby number. Usage: kick <lobby_number> <player_name>');
            }
        }
    } else if (command.startsWith('maintenance')) {
        // ex: maintenance 1 true
        const parts = command.split(' ');
        if (parts.length === 2) {
            const lobbyNumber = parseInt(parts[1], 10);
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    lobby.server.maintenance = parts[2] === 'true';
                }
            } else if (parts[1] === 'all') {
                lobbies.forEach((lobby) => {
                    lobby.server.maintenance = parts[2] === 'true';
                });
            } else {
                console.log('Invalid command format. Usage: maintenance <lobby_number> <true|false> | all <true|false>');
            }
        }
    } else if (command.startsWith('feedback')) {
        // console.log the feedback.txt file
        console.log(fs.readFileSync(path.join(__dirname, 'public/feedback.txt'), 'utf8'));  
    } else if (command.startsWith('op')) {
        // ex: op 1 "coolKid"
        const parts = command.split(' ');
        if (parts.length === 3) {
            const lobbyNumber = parseInt(parts[1], 10);
            const playerName = parts[2].replace(/"/g, '');
            if (!isNaN(lobbyNumber) && lobbyNumber > 0 && lobbyNumber <= lobbies.length) {
                const lobby = lobbies[lobbyNumber - 1];
                if (lobby && lobby.server) {
                    if (lobby.server.game.players[playerName]) {
                        lobby.server.ops.add(playerName);
                        // Update the player's color to yellow
                        lobby.server.game.players[playerName].color = "yellow";
                        lobby.server.game.players[playerName].isOp = true;
                        // Notify all clients about the updated player
                        lobby.server.io.emit('newPlayer', JSON.stringify(lobby.server.game.players[playerName]));
                        console.log(`Player ${playerName} is now op in lobby ${lobbyNumber}`);
                    } else {
                        console.log(`Player ${playerName} not found in lobby ${lobbyNumber}`);
                    }
                }
            } else {
                console.log('Invalid command format. Usage: op <lobby_number> <player_name>');
            }
        }
    } else {
        console.log('Unknown command. Available commands: ');
        console.log('game <lobby_number> - Pretty-prints the GameState of the lobby number.');
        console.log('kill <lobby_number> <player_name> - Kills the player in the specified lobby.');
        console.log('skip_round <lobby_number> - Skips the current round and starts voting phase.');
        console.log('feedback - Logs the feedback.txt file.');
        console.log('clear - Clears the console.');
        console.log('op <lobby_number> <player_name> - Makes the player an op in the specified lobby.');
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

let shuttingDown = false;
function shutdownServer(trigger = 'unknown') {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Shutdown requested (${trigger}). Closing gracefully...`);

    clearInterval(lobbyCleanupInterval);

    lobbies.forEach((lobby) => {
        if (!lobby?.server) return;
        Object.values(lobby.server.game.players).forEach((player) => {
            lobby.server.emitWithLogging('kill', JSON.stringify({ player: player.name, killer: "system" }));
        });
        lobby.server.shutdown();
    });

    io.close(() => {
        server.close(() => {
            console.log('Server closed gracefully.');
            process.exit(0);
        });
    });
}

process.on('SIGINT', () => {
    shutdownServer('SIGINT');
});

process.on('SIGTERM', () => {
    shutdownServer('SIGTERM');
});
