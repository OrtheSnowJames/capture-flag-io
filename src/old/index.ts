import express, { Response } from 'express';
import http from 'http';
import path from 'path';
import { profanity } from '@2toad/profanity';
import { Server } from 'socket.io';
// Initialize express app
const app = express();

// Create an HTTP server using express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the server
const io = new Server(server);

let reds = 0;
let blues = 0;

interface Flag {
    x: number;
    y: number;
    color: string;
    team: string;
    capturedBy: string;
}

interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    color: string;
    score: number;
    team: string;
    capture: boolean;
}

interface Game {
    players: Record<string, Player>;
    flags: {
        red: Flag;
        blue: Flag;
    };
    messages: string[];
}

const game: Game = {
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
const cameraWidth = 200; // vars for how many px to render
const cameraHeight = 200;

const fieldWidth = 1000;
const fieldHeight = 500;

function checkCollision(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        y1 < y2 + h2 &&
        y1 + h1 > y2;
}

function checkCollisionPlayerFlag(player: Player, flag: Flag): boolean {
    return checkCollision(player.x, player.y, playerWidth, playerHeight, flag.x, flag.y, flagWidth, flagHeight);
}

function getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function isProfane(something: string): boolean {
    return profanity.exists(something)
}

function censorProfanity(something: string): string {
    return profanity.censor(something)
}

// the field is 1000x500
function createFlag(team: string): Flag {
    return {
        x: team === "red" ? 100 : 900, // Red flag at 100px from the left, Blue flag at 100px from the right
        y: 250,
        color: team,
        team: team,
        capturedBy: "",
    };
}

function createPlayer(name: string, id: string, team: "red" | "blue"): Player {
    const flag = game.flags[team];
    return {
        id: id,
        name: name,
        x: Math.floor(Math.random() * 50) + (flag.x - 25), // Spawn within 50px radius of the flag's x-coordinate
        y: Math.floor(Math.random() * 50) + (flag.y - 25), // Spawn within 50px radius of the flag's y-coordinate
        color: getRandomColor(),
        score: 0,
        team: team,
        capture: false,
    };
}

function canMove(x: number, y: number): boolean {
    return x >= 0 && x <= fieldWidth - playerWidth && y >= 0 && y <= fieldHeight - playerHeight;
}

function movePlayer(player: Player, newX: number, newY: number): void {
    if (canMove(newX, newY)) {
        player.x = newX;
        player.y = newY;
    }
}

function emitWithLogging(event: string, message: any, log: boolean = true): void {
    if (log) {
        console.log(`Emitting event: ${event}, Message:`, message);
    }
    io.emit(event, message);
}

// Middleware to serve static files (optional, for client-side files)
app.use(express.static('public'));
app.use(express.json());

// Explicitly set the correct MIME type for JavaScript files
app.get('*.js', (req, res, next) => {
    res.setHeader('Content-Type', 'application/javascript');
    next();
});

// Route to serve script.js
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/script.js'));
})

// Route to serve context-engine.js
app.get('/context-engine.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/context-engine.js'));
})

// Also to serve context-engine
app.get('/script/context-engine', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/context-engine.js'));
})

// Route to serve game.js
app.get('/script/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/script/game.js'));
})

// Route to serve the shell.html file
app.get('/shell.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shell.html'));
});

// Route to check name availability
app.get('/check-name', (req: any, res: any) => {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const isNameTaken = name && game.players[name] !== undefined && game.players[name].name === name;

    if (isNameTaken || isProfane(name)) {
        console.log('Name taken or profane: ', name);
        return res.json({ available: false });
    }

    return res.json({ available: true });
});

// Set up a basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Listen for connections from clients
io.on('connection', (socket) => {
    console.log('A user connected!');

    // the message takes string
    socket.on('message', (msg: string) => {
        if (isProfane(msg)) {
            msg = censorProfanity(msg);
        }
        game.messages.push(msg);
        emitWithLogging('message', msg);
    });

    socket.on('name', (name: string) => {
        console.log('Name received: ', name); // Log the received name
        if (!name || name.trim() === "") {
            console.log("Invalid name received.");
            return;
        }
        const team = reds < blues ? "red" : "blue";
        team === "red" ? reds++ : blues++;

        const player = createPlayer(name, socket.id, team);
        game.players[name] = player;
        console.log('Player added: ', player);

        socket.emit('gameState', JSON.stringify(game));
        emitWithLogging('newPlayer', JSON.stringify(player));
    });

    socket.on('kill', (data: string | { name: string; killer: string }) => {
        if (typeof data === 'string') data = JSON.parse(data);
        const player = typeof data === 'object' && 'name' in data ? game.players[data.name] : undefined;
        if (player && typeof data === 'object' && 'killer' in data) {
            emitWithLogging('kill', JSON.stringify({ player: player.name, killer: data.killer }));
        }
    });

    socket.on('move', (data: string | { name: string; x: number; y: number }) => {
        if (typeof data === 'string') data = JSON.parse(data);
        if (typeof data === 'object' && 'name' in data) {
            console.log(`person ${data.name} moved to ${data.x}, ${data.y}`);
        }
        const player = typeof data === 'object' && 'name' in data ? game.players[data.name] : undefined;
        if (player) {
            if (typeof data === 'object' && 'x' in data && 'y' in data) {
                movePlayer(player, data.x, data.y); // Use the canMove system to restrict movement
            }

            // Check for collisions with other players
            for (const name in game.players) {
                const otherPlayer = game.players[name];
                if (otherPlayer.id !== player.id && Math.abs(player.x - otherPlayer.x) < 20 && Math.abs(player.y - otherPlayer.y) < 20) {
                    delete game.players[name];
                    emitWithLogging('kill', JSON.stringify({ player: player.name, killer: otherPlayer.name }));
                    otherPlayer.team === "red" ? reds-- : blues--;

                    if (otherPlayer.capture) {
                        const flag = game.flags[otherPlayer.team as "red" | "blue"];
                        flag.capturedBy = "";
                        flag.x = player.x;
                        flag.y = player.y;
                        emitWithLogging('flagDropped', JSON.stringify({ player: otherPlayer.name, flag: otherPlayer.team }));
                    }
                }
            }

            // Check for flag capture
            const flag = player.team === "red" ? game.flags.blue : game.flags.red;
            if (!player.capture && Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 20) {
                player.capture = true;
                flag.capturedBy = player.name;
                emitWithLogging('flagCaptured', JSON.stringify({ player: player.name, flag: flag.team }));
            }

            emitWithLogging('move', JSON.stringify(data));

            // Emit flagMoved if the player is carrying a flag
            if (player.capture) {
                emitWithLogging('flagMoved', JSON.stringify({ player: player.name, flag: flag.team, x: player.x, y: player.y }));
            }

            // Check for flag return
            if (player.capture && ((player.team === "red" && checkCollisionPlayerFlag(player, flag)) || (player.team === "blue" && checkCollisionPlayerFlag(player, flag)))) {
                player.score++;
                player.capture = false;
                emitWithLogging('flagReturned', JSON.stringify({ player: player.name, flag: flag.team }));
                flag.capturedBy = "";
                flag.x = flag.team === "red" ? 100 : 900;
                flag.y = Math.floor(Math.random() * 400) + 25;
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

// Define the port and start the server
const PORT = process.env.PORT || 4566;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

