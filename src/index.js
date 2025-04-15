// SPDX-License-Identifier: MIT
import express from 'express';
import http from 'http';
import path from 'path';
import { profanity } from '@2toad/profanity';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { json } from 'stream/consumers';

// filepath: /home/james/Documents/capture-flag-io/node/src/index.js
const __dirname = import.meta.dirname;

// Initialize express app
const app = express();

// Create an HTTP server using express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the server
const io = new Server(server);

let reds = 0;
let blues = 0;

const game = {
    players: {},
    flags: {
        red: createFlag("red"),
        blue: createFlag("blue"),
    },
    messages: [],
};

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

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function isProfane(something) {
    return profanity.exists(something);
}

function censorProfanity(something) {
    return profanity.censor(something);
}

function createFlag(team) {
    return {
        x: team === "red" ? 100 : 900,
        y: 250,
        color: team,
        team: team,
        capturedBy: "",
    };
}

function createPlayer(name, id, team) {
    const flag = game.flags[team];
    return {
        id: id,
        name: name,
        x: Math.floor(Math.random() * 50) + (flag.x - 25),
        y: Math.floor(Math.random() * 50) + (flag.y - 25),
        color: getRandomColor(),
        score: 0,
        team: team,
        capture: false,
    };
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

function emitWithLogging(event, message, log = true) {
    if (log) {
        console.log(`Emitting event: ${event}, Message:`, message);
    }
    io.emit(event, message);
}

// Middleware setup
app.use(express.static('public'));
app.use(express.json());

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

app.get('/check-name', (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const isNameTaken = name && game.players[name] !== undefined && game.players[name].name === name;

    if (isNameTaken || isProfane(name)) {
        console.log('Name taken or profane: ', name);
        return res.json({ available: false });
    }

    return res.json({ available: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected!');

    socket.on('message', (msg) => {
        if (isProfane(msg)) {
            msg = censorProfanity(msg);
        }
        game.messages.push(msg);
        emitWithLogging('message', msg);
    });

    socket.on('name', (name) => {
        console.log('Name received: ', name);
        if (!name || name.trim() === "") {
            console.log("Invalid name received.");
            return;
        }
        const team = reds < blues ? "red" : "blue";
        team === "red" ? reds++ : blues++;

        const player = createPlayer(name, socket.id, team);
        game.players[name] = player;
        console.log('Player added: ', player);

        emitWithLogging('gameState', JSON.stringify(game));
        emitWithLogging('newPlayer', JSON.stringify(player));
        console.log("flags", game.flags);
    });

    socket.on('kill', (data) => {
        if (typeof data === 'string') data = JSON.parse(data);
        const player = data?.name ? game.players[data.name] : undefined;
        if (player && data.killer) {
            emitWithLogging('kill', JSON.stringify({ player: player.name, killer: data.killer }));

            // Emit flagDropped if the killed player was carrying a flag
            if (player.capture) {
                const flag = game.flags[player.team];
                flag.capturedBy = "";
                flag.x = player.x;
                flag.y = player.y;
                emitWithLogging('flagDropped', JSON.stringify({ player: player.name, flag: player.team }));
            }
        }
    });

    socket.on('move', (data) => {
        if (typeof data === 'string') data = JSON.parse(data);
        const player = data?.name ? game.players[data.name] : undefined;
        if (player) {
            if (data.x !== undefined && data.y !== undefined) {
                movePlayer(player, data.x, data.y);
            }

            for (const name in game.players) {
                const otherPlayer = game.players[name];
                if (otherPlayer.id !== player.id && Math.abs(player.x - otherPlayer.x) < 20 && Math.abs(player.y - otherPlayer.y) < 20) {
                    delete game.players[name];
                    emitWithLogging('kill', JSON.stringify({ player: player.name, killer: otherPlayer.name }));
                    otherPlayer.team === "red" ? reds-- : blues--;

                    if (otherPlayer.capture) {
                        const flag = game.flags[otherPlayer.team];
                        flag.capturedBy = "";
                        flag.x = player.x;
                        flag.y = player.y;
                        emitWithLogging('flagDropped', JSON.stringify({ player: otherPlayer.name, flag: otherPlayer.team }));
                    }
                }
            }

            const flag = player.team === "red" ? game.flags.blue : game.flags.red;
            if (!player.capture && Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 20) {
                player.capture = true;
                flag.capturedBy = player.name;
                emitWithLogging('flagCaptured', JSON.stringify({ player: player.name, flag: flag.team }));
            }

            // Check if player is touching their own team's flag while it's not captured
            const ownFlag = game.flags[player.team];
            if (!ownFlag.capturedBy && 
                Math.abs(player.x - ownFlag.x) < 20 && 
                Math.abs(player.y - ownFlag.y) < 20) {
                // Return flag to base when teammate touches it
                ownFlag.x = player.team === "red" ? 100 : 900;
                ownFlag.y = 250;
                game.flags[player.team] = ownFlag;
                emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: ownFlag.team }));
                emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: ownFlag.team, x: ownFlag.x, y: ownFlag.y }));
            }

            io.emit('move', JSON.stringify(data));
            if (player.capture) {
                emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: flag.team, x: player.x, y: player.y }));
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
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        const playerName = Object.keys(game.players).find(name => game.players[name].id === socket.id);
        if (playerName) {
            const team = game.players[playerName].team;
            team === "red" ? reds-- : blues--;
            delete game.players[playerName];
            emitWithLogging('kill', JSON.stringify({ player: playerName, killer: "system" }));
        }
    });
});

const PORT = process.env.PORT || 4566;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});