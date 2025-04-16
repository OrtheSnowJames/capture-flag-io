import {otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField} from "./context-engine.js";

import { naem } from "./script.js"; 
declare const io: any;
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

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
}

const field: GameObject = {
    x: 0,
    y: 0,
    width: fieldWidth,
    height: fieldHeight,
};

const middleCube: GameObject = {
    x: fieldWidth / 2 - playerWidth / 2,
    y: fieldHeight / 2 - playerHeight / 2,
    width: playerWidth * 4,
    height: playerHeight * 4,
}

interface CollisionObject extends GameObject {}

interface CanMoveParams {
    x: number;
    y: number;
    objectsinside: CollisionObject[];
    objectsoutside?: CollisionObject[];
}

function canMove(
    x: CanMoveParams['x'], 
    y: CanMoveParams['y'], 
    objectsinside: CanMoveParams['objectsinside'], 
    objectsoutside: CanMoveParams['objectsoutside'] = []
): boolean {
    for (const obj of objectsoutside) {
        if (
            x >= obj.x &&
            x + playerWidth <= obj.x + obj.width &&
            y >= obj.y &&
            y + playerHeight <= obj.y + obj.height
        ) {
            return false; // Inside an object you cannot be inside of
        }
    }

    for (const obj of objectsinside) {
        if (
            x < obj.x ||
            x + playerWidth > obj.x + obj.width ||
            y < obj.y ||
            y + playerHeight > obj.y + obj.height
        ) {
            return false; // Outside an object you cannot be outside of
        }
    }

    return true; // Valid position
}

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

let game: Game = {
    players: {},
    flags: {
        red: {x: 0, y: 0, color: "red", team: "red", capturedBy: ""},
        blue: {x: 0, y: 0, color: "blue", team: "blue", capturedBy: ""},
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
        client.on('move', (data: string) => {
            const dataObj: {name: string, x: number, y: number} = JSON.parse(data);

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

        client.on('newPlayer', (data: string) => {
            const dataObj: Player = JSON.parse(data);
            game.players[dataObj.name] = dataObj;
            if (dataObj.name === naem) {
                initialized = true;
            }
        });

        client.on('gameState', (data: string) => {
            const dataObj: Game = JSON.parse(data);
            game = dataObj;
        });

        client.on('kill', (data: string) => {
            const dataObj: {player: string, killer: string} = JSON.parse(data);
            // Remove the killed player from the game object
                
            if (game.players[dataObj.player]) delete game.players[dataObj.player];

            if (game.players[dataObj.killer] && dataObj.killer !== "system")   (game.players[dataObj.killer]).score++;
        });

        client.on('flagCaptured', (data: string) => {
            const dataObj: {player: string, flag: string} = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag as keyof typeof game.flags].capturedBy = dataObj.player;
            }
        })

        client.on('flagDropped', (data: string) => {
            const dataObj: {player: string, flag: string} = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag as keyof typeof game.flags].capturedBy = "";
            }
        })

        client.on('flagMoved', (data: string) => {
            const dataObj: {player: string, flag: string, x: number, y: number} = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag as keyof typeof game.flags].x = dataObj.x;
                game.flags[dataObj.flag as keyof typeof game.flags].y = dataObj.y;
            }
        })

        client.on('flagReturned', (data: string) => {
            const dataObj: {player: string, flag: string} = JSON.parse(data);
            if (dataObj.flag in game.flags) {
                game.flags[dataObj.flag as keyof typeof game.flags].capturedBy = "";

                // move back to the base
                if (dataObj.flag === "red") {
                    game.flags.red.x = 100;
                    game.flags.red.y = 250;
                }
            }
        })

        console.log("name: ", naem);
        client.emit('name', naem);
    }

    update(deltaTime: number, commands: Commands) {
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
        } else if (!sendName) {
            client.emit('name', naem);
            sendName = true;
        }
    }

    draw(ctx: otherCtx) {
        if (!initialized) return;
        ctx.setCamera(game.players[naem].x - 255, game.players[naem].y - 155); // center camera on player
        ctx.clearBackground('#918777');
        ctx.setZoom(2.5); // to zoom into a 400x400 area of 1000x500
        
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
            const flag = game.flags[flagName as keyof typeof game.flags];
            ctx.drawRect(flag.x, flag.y, flagWidth, flagHeight, flag.color);
            if (flag.capturedBy) {
                ctx.drawText(flag.x + flagWidth / 2 - 20, flag.y - 20, `${flag.capturedBy}`, "white", 10);
            }
        }
    }
}