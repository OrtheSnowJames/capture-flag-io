import { otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField } from "./context-engine.mjs";
import { naem } from "./script.js";

// filepath: /home/james/Documents/capture-flag-io/node/public/script/game.js

const PORT = 4566;
let initialized = false;

const client = io(`http://localhost:${PORT}`); // client socket
const playerWidth = 25;
const playerHeight = 25;
const flagWidth = 25;
const flagHeight = 100;
const moveSpeed = 175;
const cameraWidth = 400; // vars for how many px to render
const cameraHeight = 400;
const fieldWidth = 1000;
const fieldHeight = 500;

const dashMultiplier = 3;
const dashDuration = 0.5; // seconds
const dashCooldown = 5; // seconds

let dashCooldownRemaining = 0; // Time remaining for cooldown
let dashActive = false; // Whether the dash is currently active
let dashTimeRemaining = 0; // Time remaining for the active dash

const field = {
    x: 0,
    y: 0,
    width: fieldWidth,
    height: fieldHeight,
};

const middleCube = {
    x: fieldWidth / 2 - playerWidth / 2,
    y: fieldHeight / 2 - playerHeight / 2,
    width: playerWidth * 4,
    height: playerHeight * 4,
};

function canMove(x, y, objectsinside, objectsoutside = []) {
    for (const obj of objectsoutside) {
        const adjustedHeight = obj.height - 20; // Reduce height for better z-index appearance
        if (
            x >= obj.x &&
            x + playerWidth <= obj.x + obj.width &&
            y >= obj.y &&
            y + playerHeight <= obj.y + adjustedHeight
        ) {
            return false; // Inside an object you cannot be inside of
        }
    }

    for (const obj of objectsinside) {
        const adjustedHeight = obj.height - 5; // Reduce height for better z-index appearance
        if (
            x < obj.x ||
            x + playerWidth > obj.x + obj.width ||
            y < obj.y ||
            y + playerHeight > obj.y + adjustedHeight
        ) {
            return false; // Outside an object you cannot be outside of
        }
    }

    return true; // Valid position
}

let game = {
    players: {},
    flags: {
        red: { x: 100, y: 250, color: "red", team: "red", capturedBy: "" },
        blue: { x: 899, y: 250, color: "blue", team: "blue", capturedBy: "" },
    },
    messages: [],
};

let sendName = false;
export class gameScene extends Scene {
    constructor() {
        super();
        this.init();
    }

    init() {
        this.initSocketIO();
    }

    initSocketIO() {
        client.on('move', (data) => {
            const dataObj = JSON.parse(data);

            const playerName = dataObj.name;
            const playerX = dataObj.x;
            const playerY = dataObj.y;

            // Update the player's position in the game object
            if (game.players[playerName]) {
                game.players[playerName].x = playerX;
                game.players[playerName].y = playerY;
            } else {
                // If the player doesn't exist, do nothing
                console.log(`Player ${playerName} not found in game object.`);
            }
        });

        client.on('newPlayer', (data) => {
            if (!initialized) {
            setTimeout(() => {
                const dataObj = JSON.parse(data);
                if (dataObj.name === naem) return;
                game.players[dataObj.name] = dataObj;
            }, 100); // retry after 100ms
            return;
            }

            if (!data) return;
            if (data.name === naem) return;

            const dataObj = JSON.parse(data);
            game.players[dataObj.name] = dataObj;
        });

        client.on('gameState', (data) => {
            const dataObj = JSON.parse(data);
            console.log("gameState", dataObj);
            game = dataObj
            initialized = true;
        });

        client.on('kill', (data) => {
            const dataObj = JSON.parse(data);
            // Remove the killed player from the game object

            if (game.players[dataObj.player]) delete game.players[dataObj.player];

            if (game.players[dataObj.killer] && dataObj.killer !== "system") game.players[dataObj.killer].score++;
        });

        client.on('flagCaptured', (data) => {
            const dataObj = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag].capturedBy = dataObj.player;
            }
        });

        client.on('flagDropped', (data) => {
            const dataObj = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag].capturedBy = "";
            }
        });

        client.on('flagMoved', (data) => {
            const dataObj = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                console.log("moving flag", dataObj.flag.team);
                game.flags[dataObj.flag].x = dataObj.x;
                game.flags[dataObj.flag].y = dataObj.y;
            }
        });

        client.on('flagReturned', (data) => {
            const dataObj = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag].capturedBy = "";

                // move back to the base
                if (dataObj.flag === "red") {
                    game.flags.red.x = 100;
                    game.flags.red.y = 250;
                } else {
                    game.flags.blue.x = 900;
                    game.flags.blue.y = 250;
                }
            }

            // make player = no capture
            if (game.players[dataObj.player]) {
                game.players[dataObj.player].capture = false;
            }
        });

        client.on('scoreUp', (data) => {
            const dataObj = JSON.parse(data);
            if (dataObj.player in game.players) {
                game.players[dataObj.player].score++;
            }
        })
    }

    update(deltaTime, commands) {
        if (initialized) {
            let moved = false;
            let newX = game.players[naem].x;
            let newY = game.players[naem].y;

            // Handle dash cooldown
            if (dashCooldownRemaining > 0) {
                dashCooldownRemaining -= deltaTime;
            }

            // Handle active dash
            if (dashActive) {
                dashTimeRemaining -= deltaTime;
                if (dashTimeRemaining <= 0) {
                    dashActive = false; // End the dash
                }
            }

            const speed = dashActive ? moveSpeed * dashMultiplier : moveSpeed;

            if (commands.keys['ArrowUp'] || commands.keys['w']) {
                newY -= speed * deltaTime;
                moved = true;
            }
            if (commands.keys['ArrowLeft'] || commands.keys['a']) {
                newX -= speed * deltaTime;
                moved = true;
            }
            if (commands.keys['ArrowDown'] || commands.keys['s']) {
                newY += speed * deltaTime;
                moved = true;
            }
            if (commands.keys['ArrowRight'] || commands.keys['d']) {
                newX += speed * deltaTime;
                moved = true;
            }

            // Trigger dash on spacebar press
            if (commands.keys[' '] && dashCooldownRemaining <= 0 && !dashActive) {
                dashActive = true;
                dashTimeRemaining = dashDuration;
                dashCooldownRemaining = dashCooldown;
            }

            const objects = [field]; // Add other objects here if needed
            if (moved && canMove(newX, newY, objects, [middleCube])) {
                game.players[naem].x = newX;
                game.players[naem].y = newY;
                client.emit('move', JSON.stringify({ name: naem, x: newX, y: newY }));
            }

            // Create an array of objects sorted by zIndex
            const renderObjects = [
                { ...field, height: field.height - 5 }, // Adjusted height for z-index
                { ...middleCube, height: middleCube.height - 5 }, // Adjusted height for z-index
                ...Object.values(game.players).map(player => ({ ...player, zIndex: 2 })),
                ...Object.values(game.flags).map(flag => ({ ...flag, zIndex: 3 })),
            ];

            renderObjects.sort((a, b) => a.zIndex - b.zIndex);

            // Optionally, store or process the sorted objects
            this.sortedObjects = renderObjects; // Store for use in draw or other methods
        } else if (!sendName) {
            client.emit('name', naem);
            sendName = true;
        }
    }

    draw(ctx) {
        if (!initialized) return;
        ctx.setCamera(game.players[naem].x - 255, game.players[naem].y - 155); // center camera on player
        ctx.clearBackground('#918777');

        // increase FOV if dash enabled
        ctx.setZoom(2.5)

        // draw the playing field
        ctx.drawRect(0, 0, 1000, 500, "#4f4d4a");

        // draw the middle cube
        ctx.drawRect(middleCube.x, middleCube.y, middleCube.width, middleCube.height, "#4f4d40");

        for (let playerName in game.players) {
            const player = game.players[playerName];
            ctx.drawRect(player.x, player.y, playerWidth, playerHeight, player.color);
            ctx.drawText((player.x + playerWidth / 2) - 20, player.y - 20, `${player.name} (${player.score}, ${player.team})`, "white", 10);
        }

        // draw flags
        for (let flagName in game.flags) {
            const flag = game.flags[flagName];
            ctx.drawRect(flag.x, flag.y, flagWidth, flagHeight, flag.color);
            if (flag.capturedBy) {
                ctx.drawText(flag.x + flagWidth / 2 - 20, flag.y - 20, `${flag.capturedBy}`, "white", 10);
            }
            if (flag.capturedBy !== "") {
                // draw the line from the flag to the player
                const player = game.players[flag.capturedBy];
                ctx.drawLine(flag.x + flagWidth / 2, flag.y + flagHeight / 2, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
            }
        }
    }
}