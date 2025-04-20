// SPDX-License-Identifier: MIT
import { otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField } from "./context-engine.mjs";
import { naem, lobbyPath, CANVAS_WIDTH, CANVAS_HEIGHT } from "./script.js";

// filepath: /home/james/Documents/capture-flag-io/node/public/script/game.js

const PORT = 4566;
let initialized = false;

let client;
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

// Movement update throttling
const movementUpdateRate = 100; // Send movement updates every 100ms
let lastMovementUpdate = 0;

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

function Task(fn) {
    (async () => {
        await fn();
    });
}

function canMove(x, y, objectsinside, objectsoutside = []) {
    for (const obj of objectsoutside) {
        const adjustedHeight = obj.height //- 20; // Reduce height for better z-index appearance
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
        const adjustedHeight = obj.height //- 5; // Reduce height for better z-index appearance
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

// Interpolation helper function
function lerp(start, end, t) {
    return start + (end - start) * t;
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

let getClient = false;
let sendName = false; 
export class gameScene extends Scene {
    messageField = new OCtxTextField(0, readableMessages * 30, 500, 60, 500/20);
    submitButton = new OCtxButton(520, readableMessages * 30, 100, 60, "Send");
    
    constructor() {
        super();
        this.init();
        this.interpolationTime = 0;
    }

    init() {
        this.messageField.setPlaceholder("Type a message");
    }

    setupListeners() {
        client.on('move', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            const playerName = data.name;
            const playerX = data.x;
            const playerY = data.y;

            // Update the player's position in the game object
            if (game.players[playerName]) {
                // Save the current position as previous position for interpolation
                if (playerName !== naem) {
                    game.players[playerName].prevX = game.players[playerName].x;
                    game.players[playerName].prevY = game.players[playerName].y;
                    game.players[playerName].targetX = playerX;
                    game.players[playerName].targetY = playerY;
                    game.players[playerName].interpolationTime = 0;
                } else {
                    // For our own player, update directly
                    game.players[playerName].x = playerX;
                    game.players[playerName].y = playerY;
                }
            } else {
                // If the player doesn't exist, do nothing
                console.log(`Player ${playerName} not found in game object.`);
            }
        });

        client.on('message', (data) => {
            const message = data;
            game.messages.push(message);
            if (game.messages.length > readableMessages) {
                game.messages.shift(); // Remove the oldest message
            }
        });

        client.on('newPlayer', (data) => {
            if (!initialized) {
            setTimeout(() => {
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                if (data.name === naem) return;
                // Add interpolation properties
                data.prevX = data.x;
                data.prevY = data.y;
                data.targetX = data.x;
                data.targetY = data.y;
                data.interpolationTime = 0;
                game.players[data.name] = data;
            }, 100); // retry after 100ms
            return;
            }

            if (!data) return;
            if (data.name === naem) return;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            // Add interpolation properties
            data.prevX = data.x;
            data.prevY = data.y;
            data.targetX = data.x;
            data.targetY = data.y;
            data.interpolationTime = 0;
            game.players[data.name] = data;
        });

        client.on('kill', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            // Remove the killed player from the game object

            if (game.players[data.player]) {
                delete game.players[data.player];
            }

            if (game.players[data.killer] && data.killer !== "system")   game.players[data.killer].score++;

            if (game.players[data.player]?.name === naem) {
                // we need to leave this scene
                initialized = false;
                dead = true;
                this.messageField.setValue("");
                this.messageField.deactivate();
                commands.switchScene(2); // Switch to the dead scene
                client.disconnect();
            }
        });

        client.on('flagCaptured', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.flag in game.flags) {
                game.flags[data.flag].capturedBy = data.player;
            }
        });

        client.on('flagDropped', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.flag in game.flags) {
                game.flags[data.flag].capturedBy = "";
            }
        });

        client.on('flagMoved', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.flag in game.flags) {
                // Add interpolation for flags too
                game.flags[data.flag].prevX = game.flags[data.flag].x;
                game.flags[data.flag].prevY = game.flags[data.flag].y;
                game.flags[data.flag].targetX = data.x;
                game.flags[data.flag].targetY = data.y;
                game.flags[data.flag].interpolationTime = 0;
                
                // Ensure we immediately update if flag is captured
                if (game.flags[data.flag].capturedBy) {
                    game.flags[data.flag].x = data.x;
                    game.flags[data.flag].y = data.y;
                }
            }
            console.log("flag moved", data);
        });

        client.on('flagReturned', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.flag in game.flags) {
                game.flags[data.flag].capturedBy = "";

                // Directly teleport flag back to the base - no interpolation
                if (data.flag === "red") {
                    // Set both target and current position to the same value to prevent interpolation
                    game.flags.red.x = 100;
                    game.flags.red.y = 250;
                    game.flags.red.prevX = 100;
                    game.flags.red.prevY = 250;
                    game.flags.red.targetX = 100;
                    game.flags.red.targetY = 250;
                    // Skip interpolation by setting time to 1
                    game.flags.red.interpolationTime = 1;
                } else {
                    // Set both target and current position to the same value to prevent interpolation
                    game.flags.blue.x = 900;
                    game.flags.blue.y = 250;
                    game.flags.blue.prevX = 900;
                    game.flags.blue.prevY = 250;
                    game.flags.blue.targetX = 900;
                    game.flags.blue.targetY = 250;
                    // Skip interpolation by setting time to 1
                    game.flags.blue.interpolationTime = 1;
                }
            }

            // make player = no capture
            if (game.players[data.player]) {
                game.players[data.player].capture = false;
            }
        });

        client.on('scoreUp', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.player in game.players) {
                game.players[data.player].score++;
            }
        })

        client.on('gameState', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            
            // Initialize interpolation values for each player
            Object.keys(data.players).forEach(playerName => {
                const player = data.players[playerName];
                player.prevX = player.x;
                player.prevY = player.y;
                player.targetX = player.x;
                player.targetY = player.y;
                player.interpolationTime = 0;
            });
            
            // Initialize interpolation values for flags
            Object.keys(data.flags).forEach(flagName => {
                const flag = data.flags[flagName];
                flag.prevX = flag.x;
                flag.prevY = flag.y;
                flag.targetX = flag.x;
                flag.targetY = flag.y;
                flag.interpolationTime = 0;
            });
            
            game = data;
            initialized = true;
        });

        client.on('connect', () => {
            getClient = true;
        });
    }

    async onLoad(commands) {
        client = await io(`http://localhost:${PORT}${lobbyPath}`,  { transports: ['websocket'], upgrade: false });
        
        await this.setupListeners();
        
        setTimeout(() => {
            client.emit('name', naem);
        }, 100);
    }

    async onExit(commands) {
        initialized = false;
        sendName = false;
        getClient = false;
        dead = false;
        game = {
            players: {},
            flags: {
                red: { x: 100, y: 250, color: "red", team: "red", capturedBy: "" },
                blue: { x: 899, y: 250, color: "blue", team: "blue", capturedBy: "" },
            },
            messages: [],
        };
        client.disconnect();
    }

    update(deltaTime, commands) {
        if (initialized) {
            try {
            let moved = false;
            let newX = game.players[naem].x;
            let newY = game.players[naem].y;

            // UI
            this.messageField.update(commands, deltaTime);
            if (this.messageField.isActive) {
                console.log("message field active");
            }
            this.submitButton.update(commands);

            if (this.submitButton.isClicked(commands) && this.messageField.getText() !== "") {
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
                    
                    // Only send movement updates at the specified rate
                    const now = performance.now();
                    if (now - lastMovementUpdate > movementUpdateRate) {
                        client.emit('move', JSON.stringify({ name: naem, x: newX, y: newY }));
                        lastMovementUpdate = now;
                    }
                }
            }

            // Update interpolation for other players
            Object.keys(game.players).forEach(playerName => {
                if (playerName !== naem) {
                    const player = game.players[playerName];
                    // Increase interpolation time
                    player.interpolationTime += deltaTime * 5; // Adjust speed factor as needed
                    
                    // Clamp interpolation time to [0, 1]
                    if (player.interpolationTime > 1) player.interpolationTime = 1;
                    
                    // Interpolate position
                    player.x = lerp(player.prevX, player.targetX, player.interpolationTime);
                    player.y = lerp(player.prevY, player.targetY, player.interpolationTime);
                }
            });

            // Update interpolation for flags
            Object.keys(game.flags).forEach(flagName => {
                const flag = game.flags[flagName];
                if (flag.interpolationTime !== undefined) {
                    // Increase interpolation time
                    flag.interpolationTime += deltaTime * 5; // Adjust speed factor as needed
                    
                    // Clamp interpolation time to [0, 1]
                    if (flag.interpolationTime > 1) flag.interpolationTime = 1;
                    
                    // Don't interpolate if flag is being carried
                    if (!flag.capturedBy) {
                        // Interpolate position
                        flag.x = lerp(flag.prevX, flag.targetX, flag.interpolationTime);
                        flag.y = lerp(flag.prevY, flag.targetY, flag.interpolationTime);
                    } else if (game.players[flag.capturedBy]) {
                        // If flag is captured, make it follow the player directly
                        const player = game.players[flag.capturedBy];
                        flag.x = player.x;
                        flag.y = player.y - flagHeight / 2;
                    }
                }
            });

            // Create an array of objects sorted by zIndex
            const renderObjects = [
                { ...field, height: field.height - 5 }, // Adjusted height for z-index
                { ...middleCube, height: middleCube.height - 5 }, // Adjusted height for z-index
                ...Object.values(game.players).map(player => ({ ...player, zIndex: 2 })),
                ...Object.values(game.flags).map(flag => ({ ...flag, zIndex: 3 })),
            ];

            renderObjects.sort((a, b) => a.zIndex - b.zIndex);

                this.sortedObjects = renderObjects; // Store for use in draw or other methods
            } catch (e) {
                // exit the scene to the death scene, add reason to globals
                commands.globals.reason = "Client side error, may be death, for nerds: " + e;
                commands.switchScene(2);
            }
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
                    // If flag is captured, update its position to follow the capturing player
                    if (flag.capturedBy && game.players[flag.capturedBy]) {
                        const player = game.players[flag.capturedBy];
                        flag.x = player.x;
                        flag.y = player.y - flagHeight / 2;
                    }
                    
                    ctx.drawImageScaled(flag.team === "red" ? redFlagImage : blueFlagImage, flag.x, flag.y, flagWidth, flagHeight);

                    if (flag.capturedBy) {
                        const player = game.players[flag.capturedBy];
                        if (player && player.x && player.y) {
                            ctx.drawLine(flag.x + flagWidth/2, flag.y + flagHeight / 2, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
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

            // Display messages from bottom to top (newest at bottom)
            const displayMessages = [...game.messages].slice(-readableMessages); // Get last N messages
            for (let i = 0; i < displayMessages.length; i++) {
                const message = displayMessages[i];
                const messageY = (i + 1) * 30 - 10; // -10 to adjust text position vertically
                ctx.drawText(5, messageY, message, "white", 20, false, false);
            }

            // UI
            this.messageField.draw(ctx, false, false);
            this.submitButton.draw(ctx, false, false);
        }
    }
}

export class deadScene extends Scene {
    reason = "";
    showTechnicalDetails = false;
    detailsButton = new OCtxButton(CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT * 0.4, 300, 60, "Show Technical Details");

    constructor() {
        super();
    }

    async onLoad(commands) {
        this.reason = commands.globals.reason;
        this.showTechnicalDetails = false;
    }
    async onExit(commands) {}

    update(deltaTime, commands) {
        this.detailsButton.update(commands);
        
        if (this.detailsButton.isClicked(commands)) {
            this.showTechnicalDetails = !this.showTechnicalDetails;
            this.detailsButton.label = this.showTechnicalDetails ? "Hide Technical Details" : "Show Technical Details";
        }
        
        if (commands.keys['Enter']) {
            window.location.reload();
        }
    }

    draw(ctx) {
        ctx.setCamera(0, 0);
        ctx.setZoom(1);
        ctx.clearBackground('black');
        
        // Main death message
        ctx.drawText(CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, CANVAS_HEIGHT * 0.1, "You are dead.", "white", 50);
        ctx.drawText(CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, CANVAS_HEIGHT * 0.2, "Press Enter to reload and pick a new name.", "white", 30);
        
        // Extract and display user-friendly reason
        let userFriendlyReason = "Unknown cause of death.";
        let technicalDetails = "";
        
        if (this.reason && this.reason !== "") {
            const nerdsIndex = this.reason.indexOf("for nerds:");
            if (nerdsIndex !== -1) {
                userFriendlyReason = this.reason.substring(0, nerdsIndex).trim();
                technicalDetails = this.reason.substring(nerdsIndex);
            } else {
                userFriendlyReason = this.reason;
            }
        }
        
        // Display user-friendly reason
        ctx.drawText(CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, CANVAS_HEIGHT * 0.3, userFriendlyReason, "white", 30);
        
        // Draw the details button
        this.detailsButton.draw(ctx);
        
        // Display technical details only when showTechnicalDetails is true
        if (this.showTechnicalDetails && technicalDetails !== "") {
            const lines = technicalDetails.split('\n');
            for (let i = 0; i < lines.length; i++) {
                ctx.drawText(20, CANVAS_HEIGHT * 0.5 + (i * 30), lines[i], "#aaaaaa", 18);
            }
        }
    }
}