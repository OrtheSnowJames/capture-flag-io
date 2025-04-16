// SPDX-License-Identifier: MIT
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
const readableMessages = 7; // num * 30 = how much px is the message box
const fieldWidth = 1000;
const fieldHeight = 500;

const dashMultiplier = 3;
const dashDuration = 0.5; // seconds
const dashCooldown = 5; // seconds

let dashCooldownRemaining = 0; // Time remaining for cooldown
let dashActive = false; // Whether the dash is currently active
let dashTimeRemaining = 0; // Time remaining for the active dash

let redFlagImage = new Image(25, 100);
    redFlagImage.src = "/assets/redflag.png";
let blueFlagImage = new Image(25, 100);
    blueFlagImage.src = "/assets/blueflag.png";

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

let dead = false;

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
    messageField = new OCtxTextField(0, readableMessages * 30, 500, 30, 500/20);
    submitButton = new OCtxButton(520, readableMessages * 30, 100, 30, "Send");
    constructor() {
        super();
        this.init();
    }

    init() {
        this.messageField.setPlaceholder("Type a message");
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

        client.on('message', (data) => {
            game.messages.push(data);
            if (game.messages.length > readableMessages) {
                game.messages.shift(); // Remove the oldest message
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

            if (game.players[dataObj.player]) {
                delete game.players[dataObj.player];
                console.log("player killed", dataObj.player);
            }

            if (game.players[dataObj.killer] && dataObj.killer !== "system")   game.players[dataObj.killer].score++;

            if (game.players[dataObj.player].name === naem) {
                // we need to leave this scene
                initialized = false;
                dead = true;
                commands.switchScene(2); // Switch to the dead scene
                client.disconnect();
            }
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

            // UI
            this.messageField.update(deltaTime, commands);
            if (this.messageField.isActive) {
                console.log("message field active");
            }
            this.submitButton.update(commands);

            if (this.submitButton.isClicked(commands)) {
                const message = this.messageField.getText();
                if (message !== undefined) {
                    client.emit('message', JSON.stringify(`${naem} said ${message}`)); 
                    this.messageField.setValue("");
                }
                console.log("message sent", message);
            }

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
            if (moved) {
                if (canMove(newX, newY, objects, [middleCube])) {
                    game.players[naem].x = newX;
                    game.players[naem].y = newY;
                    client.emit('move', JSON.stringify({ name: naem, x: newX, y: newY }));
                }
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
        } else if (dead) {
            
        }
    }

    draw(ctx) {
        if (!initialized) return;
        
        // Check if player exists and has required properties
        if (!game.players[naem] || 
            typeof game.players[naem].x === 'undefined' || 
            typeof game.players[naem].y === 'undefined') {
            return;
        }

        // Set camera position
        ctx.setZoom(2.5);
        ctx.setCamera(game.players[naem].x - 255, game.players[naem].y - 155);
        ctx.clearBackground('#918777');

        // Draw field if it exists
        if (field && field.width && field.height) {
            ctx.drawRect(field.x, field.y, field.width, field.height, "#4f4d4a");
        }

        // Draw middle cube if it exists
        if (middleCube && middleCube.width && middleCube.height) {
            ctx.drawRect(middleCube.x, middleCube.y, middleCube.width, middleCube.height, "#4f4d40");
        }

        // Draw flags if they exist
        if (game.flags) {
            Object.values(game.flags).forEach(flag => {
                if (flag && typeof flag.x !== 'undefined' && typeof flag.y !== 'undefined') {
                    ctx.drawImageScaled(flag.team === "red" ? redFlagImage : blueFlagImage, flag.x, flag.y, flagWidth, flagHeight);

                    if (flag.capturedBy) {
                        const player = game.players[flag.capturedBy];
                        if (player && player.x && player.y) {
                            ctx.drawLine(flag.x, flag.y + flagHeight / 2, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
                        }
                    }
                }
            });
        }

        // Draw players if they exist
        if (game.players) {
            Object.values(game.players).forEach(player => {
                if (player && 
                    typeof player.x !== 'undefined' && 
                    typeof player.y !== 'undefined' && 
                    player.color) {
                    ctx.drawRect(player.x, player.y, playerWidth, playerHeight, player.color);
                    
                    // Draw player name if it exists
                    if (player.name) {
                        ctx.drawText(
                            (player.x + playerWidth / 2) - 20,
                            player.y - 20,
                            `${player.name} (${player.score || 0}, ${player.team || ""})`,
                            "white",
                            10
                        );
                    }
                }
            });

            // Draw message box
            const messageBoxHeight = readableMessages * 30;
            const messageBoxWidth = 500;
            ctx.drawRect(
                0,
                0,
                messageBoxWidth,
                messageBoxHeight,
                "rgba(255, 255, 255, 0.5)",
                false,
                false
            );

            for (let message of game.messages) {
                const messageIndex = game.messages.indexOf(message);
                const messageY = messageBoxHeight - (messageIndex + 1) * 30;
                ctx.drawText(5, messageY, message, "white", 20, false, false);
            }

            // UI
            this.messageField.draw(ctx, false, false);
            this.submitButton.draw(ctx, false, false);
        }
    }
}

export class deadScene extends Scene {
    constructor() {
        super();
    }

    update(deltaTime, commands) {
        if (commands.keys['Enter']) {
            window.location.reload();
        }
    }

    draw(ctx) {
        ctx.setCamera(0, 0);
        ctx.clearBackground('black');
        ctx.drawText(CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, CANVAS_HEIGHT * 0.1, "You are dead.", "white", 50);
        ctx.drawText(CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, CANVAS_HEIGHT * 0.2, "Press Enter to reload and pick a new name.", "white", 30);
    }
}