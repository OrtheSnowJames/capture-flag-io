// SPDX-License-Identifier: MIT
import { otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField } from "./context-engine.mjs";
import { naem, engine, lobbyPath, musicPlay, privcode, CANVAS_WIDTH, CANVAS_HEIGHT } from "./script.js";
import { timeData } from "./globals.js";
// filepath: /home/james/Documents/capture-flag-io/node/public/script/game.js

const PORT = 4566;
let initialized = false;

let client;
let newMusicPlay;
setTimeout(() => {
    newMusicPlay = musicPlay;
}, 1000);
export let goToDead = true;
let intermission = false;
let winners = {"player": "", "team": ""};
let mapSelection = [];
let votedFor = "";
let mapVotes = {};
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
const messageBoxHeight = readableMessages * 30;
const messageBoxWidth = 500;

// Player skins
const skins = [
    null, // index 0 = no skin (default)
    new Image(playerWidth, playerHeight), // index 1 = first skin
    new Image(playerWidth, playerHeight), // index 2 = second skin
    new Image(playerWidth, playerHeight)  // index 3 = third skin
];

// Load the skin images
skins[1].src = "/assets/skins/skin1.png";
skins[2].src = "/assets/skins/skin2.png";
skins[3].src = "/assets/skins/skin3.png";

// Maps 
let maps = {};
let currentMapData = null;
let mapObjects = [];

// Movement update throttling
const movementUpdateRate = 100; // Send movement updates every 100ms
let lastMovementUpdate = 0;

// Add a playerMessages object to track messages with timestamps
let playerMessages = {};
const MESSAGE_DISPLAY_DURATION = 5000; // 5 seconds in milliseconds

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

// audio
let audio = {
    maps: {
        "map1": {
            "bgm": new Audio("/assets/music/evansong1.wav")
        },
        "map2": {
            "bgm": new Audio("/assets/music/evansong1.wav")
        }
    }
}

// Default field - dimensions will come from the map data
const field = {
    x: 0,
    y: 0,
    width: fieldWidth,
    height: fieldHeight,
};

// Add these variables near the top of the file with other state variables
let votingTimer = 10; // 10 seconds for voting
let votingActive = false;

// Add this near the top with other global variables
let isOvertime = false;

// Load maps from JSON file
async function loadMaps() {
    try {
        const response = await fetch('/assets/maps.json');
        maps = await response.json();
        console.log("Maps loaded:", maps);
        return true;
    } catch (error) {
        console.error("Error loading maps:", error);
        return false;
    }
}

function checkCollision(objA, objB) {
    // Simple AABB collision for non-rotated objects
    if (!objB.rotation) {
        return objA.x < objB.x + objB.width &&
               objA.x + objA.width > objB.x &&
               objA.y < objB.y + objB.height &&
               objA.y + objA.height > objB.y;
    } else {
        // For rotated objects, we need a more complex check
        // For now, approximate with a simpler check based on the center distance
        // This is an approximation and could be improved with proper rotated rectangle collision
        const centerAX = objA.x + objA.width / 2;
        const centerAY = objA.y + objA.height / 2;
        const centerBX = objB.x + objB.width / 2;
        const centerBY = objB.y + objB.height / 2;
        
        // Calculate distance between centers
        const dx = centerAX - centerBX;
        const dy = centerAY - centerBY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Use the maximum of half-width and half-height as a rough approximation
        const radiusA = Math.max(objA.width, objA.height) / 2;
        const radiusB = Math.max(objB.width, objB.height) / 2;
        
        return distance < (radiusA + radiusB);
    }
}

function getMapByName(mapName) {
    // loop through maps and find the map object that matches the name
    for (const key of Object.keys(maps)) {
        if (maps[key].name === mapName) {
            return maps[key];
        }
    }
    return null;
}

// Parse map data and create game objects
function parseMap(mapName) {
    if (!getMapByName(mapName) && !maps[mapName]) {
        console.error(`Map ${mapName} not found`);
        return false;
    }
    
    const map = getMapByName(mapName) === null ? maps[mapName] : getMapByName(mapName);
    currentMapData = map;
    
    // Helper function to check if a string is an image path
    const isImagePath = (path) => {
        if (!path || typeof path !== 'string') return false;
        return path.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null || path.startsWith('img(');
    };
    
    // Extract image path from different formats
    const getImagePath = (path) => {
        if (!path || typeof path !== 'string') return '';
        if (path.startsWith('img(')) {
            return path.slice(4, -1).replace(/['"]/g, ''); // Extract from img('path') and remove quotes
        }
        return path; // Return direct path
    };
    
    // Set backgrounds - check for image paths
    if (isImagePath(map.bg)) {
        field.bg = new Image();
        field.bg.src = getImagePath(map.bg);
        field.bgIsImage = true;
    } else {
        field.bg = map.bg || "#4f4d4a";
        field.bgIsImage = false;
    }
    
    if (isImagePath(map.outbg)) {
        field.outbg = new Image();
        field.outbg.src = getImagePath(map.outbg);
        field.outbgIsImage = true;
    } else {
        field.outbg = map.outbg || "#918777";
        field.outbgIsImage = false;
    }
    
    // Clear existing map objects
    mapObjects = [];
    
    // Parse and create map objects
    if (map.objects && Array.isArray(map.objects)) {
        map.objects.forEach(obj => {
            try {
                const evalInContext = (expr, context) => {
                    const paramNames = Object.keys(context);
                    const paramValues = Object.values(context);
                    const evaluator = new Function(...paramNames, `return ${expr};`);
                    return evaluator(...paramValues);
                };
                
                // First determine if we're dealing with images
                let imgObject = null;
                let isTypeImage = typeof obj.type === 'string' && obj.type.startsWith('img(');
                let isColorImage = isImagePath(obj.color);
                
                // Create the image object if needed
                if (isTypeImage || isColorImage) {
                    imgObject = new Image();
                    if (isTypeImage) {
                        imgObject.src = getImagePath(obj.type);
                    } else if (isColorImage) {
                        imgObject.src = getImagePath(obj.color);
                    }
                    
                    // We can use a trick to get the dimensions if the image is already in cache
                    if (imgObject.complete) {
                        // Image is already loaded, we can use the dimensions
                    } else {
                        // Set default dimensions that will be updated when the image loads
                        imgObject.width = 100;  // Default width
                        imgObject.height = 100; // Default height
                        
                        // Set up a load handler to update the object after the image loads
                        imgObject.onload = function() {
                            // Find the object in mapObjects and update its dimensions if needed
                            const objIndex = mapObjects.findIndex(o => 
                                o.imageSrc === imgObject.src || 
                                (o.color === imgObject && o.isImageColor)
                            );
                            
                            if (objIndex !== -1) {
                                // Only update if dimensions weren't explicitly provided
                                if (typeof obj.width === 'undefined') {
                                    mapObjects[objIndex].width = imgObject.naturalWidth;
                                }
                                if (typeof obj.height === 'undefined') {
                                    mapObjects[objIndex].height = imgObject.naturalHeight;
                                }
                            }
                        };
                    }
                }
                
                // Set up the context with image dimensions if available
                const evalContext = {
                    canvasWidth: fieldWidth,
                    canvasHeight: fieldHeight,
                    playerWidth: playerWidth,
                    playerHeight: playerHeight,
                    // Add the image object to the context if it exists
                    img: imgObject
                };
                
                // Now evaluate the expressions using our enhanced context
                const x = typeof obj.x === 'string' ? 
                    evalInContext(obj.x, evalContext) : obj.x;
                const y = typeof obj.y === 'string' ? 
                    evalInContext(obj.y, evalContext) : obj.y;
                
                // For width and height, use image dimensions if not specified
                let width, height;
                
                if (typeof obj.width === 'string') {
                    width = evalInContext(obj.width, evalContext);
                } else if (obj.width !== undefined) {
                    width = obj.width;
                } else if (imgObject) {
                    width = imgObject.naturalWidth || imgObject.width;
                }
                
                if (typeof obj.height === 'string') {
                    height = evalInContext(obj.height, evalContext);
                } else if (obj.height !== undefined) {
                    height = obj.height;
                } else if (imgObject) {
                    height = imgObject.naturalHeight || imgObject.height;
                }
                
                let color = obj.color;
                let isImageColor = false;
                
                if (isImagePath(obj.color)) {
                    color = imgObject || new Image();
                    if (!imgObject) {
                        color.src = getImagePath(obj.color);
                    }
                    isImageColor = true;
                }

                // Check if this is an image type object
                let isImage = false;
                let imageSrc = '';
                if (isTypeImage) {
                    isImage = true;
                    imageSrc = getImagePath(obj.type);
                    color = imgObject || new Image();
                    if (!imgObject) {
                        color.src = imageSrc;
                    }
                    isImageColor = true;
                }
                
                // Get rotation if specified (in radians)
                let rotation = 0;
                if (typeof obj.rotation === 'string') {
                    rotation = evalInContext(obj.rotation, evalContext);
                } else if (typeof obj.rotation === 'number') {
                    rotation = obj.rotation;
                }
                
                // Determine collision type: 'inside', 'outside', or null (no collision)
                let collideType = null;
                if (obj.collide === 'inside') {
                    collideType = 'inside';
                } else if (obj.collide === 'outside' || obj.collide === true) {
                    collideType = 'outside';
                }
                // If obj.collide is false or undefined, collideType remains null
                
                mapObjects.push({
                    type: isImage ? 'image' : obj.type,
                    functionalType: obj.type,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    color: color,
                    isImageColor: isImageColor,
                    imageSrc: isImage ? imageSrc : (isImageColor ? getImagePath(obj.color) : null),
                    collideType: collideType, // New property to store collision type
                    rotation: rotation,
                    property: obj.property
                });
            } catch (e) {
                console.error("Error parsing map object:", e, obj);
            }
        });
    }
    
    console.log("Map parsed:", mapName, mapObjects);
    return true;
}

function Task(fn) {
    (async () => {
        await fn();
    });
}

function predictMove(x, y, objectsinside = [], objectsoutside = [], mapBounds) {
    // Get the current player for team check
    const player = game.players[naem];
    if (!player) return { w: false, a: false, s: false, d: false };
    
    const moveDirections = {
        w: true, // up
        a: true, // left
        s: true, // down
        d: true  // right
    };
    
    // Use a larger test step (10 pixels) for collision prediction
    // This ensures we detect collisions that would occur within a few frames
    const testStep = 10;
    
    // Check boundary and object collisions for each direction
    const testPositions = {
        w: { x: x, y: y - testStep },  // Up movement
        a: { x: x - testStep, y: y },  // Left movement
        s: { x: x, y: y + testStep },  // Down movement
        d: { x: x + testStep, y: y }   // Right movement
    };
    
    // Test each direction
    for (const [direction, pos] of Object.entries(testPositions)) {
        // Check if inside play field bounds
        if (pos.x < 0 || pos.x + playerWidth > field.width || 
            pos.y < 0 || pos.y + playerHeight > field.height) {
            moveDirections[direction] = false;
            continue;
        }
        
        // Check collision with objects player must stay outside of
        for (const obj of objectsoutside) {
            if (checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                obj
            )) {
                moveDirections[direction] = false;
                break;
            }
        }
        
        // Skip further checks if already determined can't move in this direction
        if (!moveDirections[direction]) continue;
        
        // Check collision with objects player must stay inside of
        for (const obj of objectsinside) {
            if (!checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
            )) {
                moveDirections[direction] = false;
                break;
            }
        }
        
        // Skip further checks if already determined can't move in this direction
        if (!moveDirections[direction]) continue;
        
        // Check collision with map objects based on their collideType and teamblock properties
        for (const obj of mapObjects) {
            // Skip objects that are already checked in objectsinside or objectsoutside
            const isAlreadyChecked = [...objectsinside, ...objectsoutside].some(checkedObj => 
                checkedObj.x === obj.x && 
                checkedObj.y === obj.y && 
                checkedObj.width === obj.width && 
                checkedObj.height === obj.height
            );
            
            if (isAlreadyChecked) continue;
            
            // First check if the player is colliding with this object
            const isColliding = checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                obj
            );
            
            // If there's a collision, check if it's a teamblock
            if (isColliding && obj.property && obj.property.teamblock) {
                // If teamblock doesn't match player's team, block movement
                if (obj.property.teamblock !== player.team) {
                    moveDirections[direction] = false;
                    break;
                }
                // If it matches, allow entry regardless of other collision settings
            }
            
            // Then handle standard collision types
            if (obj.collideType === 'outside' && isColliding) {
                moveDirections[direction] = false;
                break;
            } else if (obj.collideType === 'inside' && !isColliding) {
                moveDirections[direction] = false;
                break;
            }
        }
    }
    
    return moveDirections;
}

function canMove(x, y, objectsinside = [], objectsoutside = []) {
    // Get the current player for team check
    const player = game.players[naem];
    if (!player) return false;
    
    // Check if inside play field bounds
    if (x < 0 || x + playerWidth > field.width || y < 0 || y + playerHeight > field.height) {
        return false;
    }
    
    // Check collision with objects player must stay outside of (can't be inside these)
    for (const obj of objectsoutside) {
        if (checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            obj
        )) {
            return false; // Inside an object you cannot be inside of
        }
    }

    // Check collision with objects player must stay inside of
    for (const obj of objectsinside) {
        if (!checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
        )) {
            return false; // Outside an object you must be inside of
        }
    }
    
    // Check collision with map objects based on their collideType and teamblock properties
    for (const obj of mapObjects) {
        // Skip objects that are already checked in objectsinside or objectsoutside
        const isAlreadyChecked = [...objectsinside, ...objectsoutside].some(checkedObj => 
            checkedObj.x === obj.x && 
            checkedObj.y === obj.y && 
            checkedObj.width === obj.width && 
            checkedObj.height === obj.height
        );
        
        if (isAlreadyChecked) continue;
        
        // First check if the player is colliding with this object
        const isColliding = checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            obj
        );
        
        // If there's a collision, check if it's a teamblock
        if (isColliding && obj.property && obj.property.teamblock) {
            // If teamblock doesn't match player's team, block movement
            if (obj.property.teamblock !== player.team) {
                return false; // Wrong team - can't enter
            }
            // If it matches, allow entry regardless of other collision settings
        }
        
        // Then handle standard collision types
        if (obj.collideType === 'outside' && isColliding) {
            return false; // Collision with 'outside' object - can't move here
        } else if (obj.collideType === 'inside' && !isColliding) {
            return false; // Not inside an 'inside' object - can't move here
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
    currentMap: "map1" // Default map
};

let bottomAnnouncement = {
    header: "Capture the flag",
    body: "Team Game",
    active: true,
    timer: new timeData(5)
}

let getClient = false;
let sendName = false; 
export class gameScene extends Scene {
    // Define UI ratios
    messageBoxWidthRatio = 0.3125; // 500/1600
    messageBoxHeightRatio = 0.2625; // 210/800
    messageFieldHeightRatio = 0.075; // 60/800
    buttonWidthRatio = 0.0875; // 140/1600
    buttonHeightRatio = 0.075; // 60/800
    timerBoxWidthRatio = 0.09375; // 150/1600
    timerBoxHeightRatio = 0.0625; // 50/800
    messageFontSizeRatio = 0.025; // 20/800
    timerFontSizeRatio = 0.025; // 20/800
    announcementFontSizeRatio = 0.0375; // 30/800
    voteFontSizeRatio = 0.025; // 20/800
    voteTimerFontSizeRatio = 0.03; // 24/800

    messageField = new OCtxTextField(0, readableMessages * 30, 500, 60, Math.round(500/23));
    submitButton = new OCtxButton(520, readableMessages * 30, 100, 60, "Send");
    musicButton = new OCtxButton(50, messageBoxHeight + 140, 140, 60, "Music Mute");
    backButton = new OCtxButton(50, messageBoxHeight + 70, 140, 60, "Back");
    announcementText = "";
    announcementTimer = 0;
    announcementActive = false;

    // Replace individual buttons with an array
    mapButtons = [];
    
    constructor() {
        super();
        this.init();
        this.interpolationTime = 0;
        this.mapsLoaded = false;
        this.loadedMap = null;
        this.timestamp = new timeData(5 * 60); // 5 minutes
        
        // Create buttons dynamically - we'll support up to 3 maps by default
        const buttonWidth = CANVAS_WIDTH * 0.15625; // 250/1600
        const buttonHeight = CANVAS_HEIGHT * 0.075; // 60/800
        const howManyButtons = 3; // how many buttons to display
        for (let i = 0; i < howManyButtons; i++) {
            const button = new OCtxButton(
                CANVAS_WIDTH * ((i + 1) * 0.25) - buttonWidth/2, 
                CANVAS_HEIGHT * 0.4, 
                buttonWidth, 
                buttonHeight, 
                `Map ${i+1}`
            );
            button.deactivate();
            this.mapButtons.push(button);
        }
    }

    init() {
        const messageBoxWidth = CANVAS_WIDTH * this.messageBoxWidthRatio;
        const messageBoxHeight = CANVAS_HEIGHT * this.messageBoxHeightRatio;
        const messageFieldHeight = CANVAS_HEIGHT * this.messageFieldHeightRatio;
        const buttonWidth = CANVAS_WIDTH * this.buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * this.buttonHeightRatio;

        this.messageField = new OCtxTextField(
            0,
            messageBoxHeight,
            messageBoxWidth,
            messageFieldHeight,
            Math.round(messageBoxWidth/23)
        );

        this.submitButton = new OCtxButton(
            messageBoxWidth + CANVAS_WIDTH * 0.0125, // 20/1600
            messageBoxHeight,
            buttonWidth,
            buttonHeight,
            "Send"
        );

        this.musicButton = new OCtxButton(
            CANVAS_WIDTH * 0.03125, // 50/1600
            messageBoxHeight + CANVAS_HEIGHT * 0.175, // 140/800
            buttonWidth,
            buttonHeight,
            "Music Mute"
        );

        this.backButton = new OCtxButton(
            CANVAS_WIDTH * 0.03125, // 50/1600
            messageBoxHeight + CANVAS_HEIGHT * 0.0875, // 70/800
            buttonWidth,
            buttonHeight,
            "Back"
        );

        this.messageField.setPlaceholder("Type a message");
    }



    setupListeners() {
        client.on('move', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            const playerName = data.name;
            
            // Ignore move events for the local player to prevent position corrections
            if (playerName === naem) {
                return;
            }
            
            const playerX = data.x;
            const playerY = data.y;

            // Update the player's position in the game object
            if (game.players[playerName]) {
                // Save the current position as previous position for interpolation
                game.players[playerName].prevX = game.players[playerName].x;
                game.players[playerName].prevY = game.players[playerName].y;
                game.players[playerName].targetX = playerX;
                game.players[playerName].targetY = playerY;
                game.players[playerName].interpolationTime = 0;
            } else {
                // If the player doesn't exist, do nothing
                console.log(`Player ${playerName} not found in game object.`);
            }
        });

        client.on('message', (data) => {
            const message = data;
            if (typeof message !== 'string') return;
            if (message.startsWith("!op")) return;
            game.messages.push(message);
            if (game.messages.length > readableMessages) {
                game.messages.shift(); // Remove the oldest message
            }
            
            // Extract player name from message format "playername said message"
            const match = message.match(/^(.+?) said (.+)$/);
            if (match && match.length === 3) {
                const playerName = match[1];
                const messageText = match[2];
                
                // Store the message with timestamp
                playerMessages[playerName] = {
                    text: messageText,
                    timestamp: performance.now()
                };
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

            this.bottomAnnouncementSet("Flag Captured!", `by ${data.player}`);
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

            // if this is a score, show a score
            if (data.scoredBy) {
                this.bottomAnnouncementSet("Team Scored!", `by ${data.scoredBy}, for ${game.players[data.scoredBy].team}`);
            } else {
                this.bottomAnnouncementSet("Flag Returned.", `by ${data.player}`);
            }
        });

        client.on('scoreUp', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.player in game.players) {
                // Update the player's score with the value sent from the server
                // If score is provided, use it, otherwise just increment
                if (data.score !== undefined) {
                    game.players[data.player].score = data.score;
                } else {
                    // Fallback in case the score value isn't provided
                    game.players[data.player].score = (game.players[data.player].score || 0) + 1;
                }
            }

            this.bottomAnnouncementSet("Score Updated!", `${data.player} now has ${data.score} points`);
        });

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
            
            // Preserve the current map
            if (data.currentMap) {
                game.currentMap = data.currentMap;
            } else {
                data.currentMap = game.currentMap;
            }
            
            game = data;
            initialized = true;
        });

        client.on('connect', () => {
            getClient = true;
        });

        client.on('playerVotedFor', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (data.player === naem) {
                votedFor = data.map;
            } else {
                // Remove player from any existing votes
                for (const map in mapVotes) {
                    if (mapVotes[map]) {
                        mapVotes[map] = mapVotes[map].filter(player => player !== data.player);
                    }
                }
                
                // Initialize the map's vote array if it doesn't exist
                if (!mapVotes[data.map]) {
                    mapVotes[data.map] = [];
                }
                
                // Add the player to the voted map
                if (!mapVotes[data.map].includes(data.player)) {
                    mapVotes[data.map].push(data.player);
                }
            }
        });

        client.on('mapChange', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            
            if (data.currentMap) {
                // Update the current map
                game.currentMap = data.currentMap;
                console.log(`Map changed to: ${data.currentMap}`);
                
                // End intermission and voting when map changes
                intermission = false;
                votingActive = false;
                isOvertime = false;
                
                // Reset timer to 5 minutes when new map is loaded
                this.timestamp = new timeData(5 * 60);
                
                // Reset map selection and votes
                mapSelection = [];
                mapVotes = {};
            }
        });

        client.on('timerUpdate', (timeString) => {
            // Update the local timestamp display with the server's time
            if (initialized) {
                if (timeString === "OVERTIME") {
                    isOvertime = true;
                } else {
                    isOvertime = false;
                    this.timestamp.setFromString(timeString);
                }
            }
        });

        client.on('overtimeStarted', (message) => {
            // Display overtime message
            isOvertime = true;
            
            // Add message to game messages
            if (game.messages) {
                game.messages.push("OVERTIME: " + message);
                // Keep only the last 10 messages
                if (game.messages.length > 10) {
                    game.messages.shift();
                }
            }
        });

        client.on('gameOver', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            winners.player = data.winner;
            winners.team = data.teamwinner;
            intermission = true;
            isOvertime = false;
            
            // Stop local timer countdown during intermission
            // Will be reset when a new map is loaded
            this.timestamp = new timeData(5 * 60);
            
            // Reset and start the voting timer
            votingTimer = 10;
            votingActive = true;

            // Handle map selection
            const maps = data.maps;
            if (!Array.isArray(maps) || maps.length === 0) return;
            
            // Filter out the current map if it's in the array
            const filteredMaps = maps.filter(map => map !== game.currentMap);
            
            // Only set if we have at least one map
            if (filteredMaps.length > 0) {
                mapSelection = filteredMaps;
                
                // Initialize vote arrays for each map
                mapSelection.forEach(map => {
                    if (!mapVotes[map]) {
                        mapVotes[map] = [];
                    }
                });

                // Activate/deactivate buttons based on available maps
                this.mapButtons.forEach((button, index) => {
                    if (index < mapSelection.length) {
                        button.activate();
                        button.label = mapSelection[index]; // Set the button label
                    } else {
                        button.deactivate();
                    }
                });
            }
        });

        client.on('flagsState', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            game.flags = data;
        });

        client.on('skinChange', (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            const playerName = data.player;
            const skinId = data.skin;
            
            if (game.players[playerName]) {
                game.players[playerName].skin = skinId;
            }
        });

        client.on('announce', (message) => {
            this.announcementText = message;
            this.announcementTimer = 7; // 7 seconds
            this.announcementActive = true;
        });
    }

    async onLoad(commands) {
        newMusicPlay = musicPlay
        // Load maps first
        if (!await loadMaps()) {
            commands.globals.reason = "Failed to load maps. Please try again.";
            commands.switchScene(2);
            return;
        }
        
        this.mapsLoaded = true;
        
        // Parse default map
        if (!parseMap("map1")) {
            commands.globals.reason = "Failed to parse default map. Please try again.";
            commands.switchScene(2);
            return;
        }
        
        this.loadedMap = "map1";
        
        // Connect to server
        try {
            client = await io(`${lobbyPath}`,  { transports: ['websocket'], upgrade: false });
        
            await this.setupListeners();
            
            // Reset client-side timer
            this.timestamp = new timeData(5 * 60);
            
            // Start BGM for initial map and set initial mute state
            startBGM();
            muteBGM(!newMusicPlay);
            
            setTimeout(() => {
                client.emit('name', naem);
            }, 100);
        } catch (error) {
            commands.globals.reason = "Failed to connect to server. Please try again.";
            commands.switchScene(2);
        }
    }

    async onExit(commands) {
        initialized = false;
        sendName = false;
        getClient = false;
        dead = false;
        muteBGM(true); // Mute BGM when exiting
        game = {
            players: {},
            flags: {},
            messages: [],
            currentMap: "map1"
        };
        if (client) {
            client.disconnect();
        }
    }

    bottomAnnouncementSet(header, body) {
        bottomAnnouncement.header = header;
        bottomAnnouncement.body = body;
        bottomAnnouncement.active = true;
        bottomAnnouncement.timer.setSeconds(5);
    }

    resetGame() {
        muteBGM(true); // Mute BGM when resetting game
        game = {
            players: {},
            flags: {},
            messages: [],
            currentMap: "map1"
        };
        if (client) {
            client.disconnect();
        }
        this.timestamp = new timeData(5 * 60);
        votingActive = false;
        intermission = false;
        isOvertime = false;
        mapSelection = [];
        mapVotes = {};
        votedFor = null;
        dashActive = false;
        dashCooldownRemaining = 0;
        dashTimeRemaining = 0;
        playerMessages = {};
        lastMovementUpdate = 0;
        initialized = false;
        sendName = false;
        getClient = false;
        dead = false;

        engine.scenes[1] = new gameScene();
    }

    update(deltaTime, commands) {
        try {
            if (initialized && this.mapsLoaded) {
                // Update announcement timer
                if (this.announcementActive) {
                    this.announcementTimer -= deltaTime;
                    if (this.announcementTimer <= 0) {
                        this.announcementActive = false;
                        this.announcementText = "";
                    }
                }

                // Only process movement if no announcement is active
                if (game.players[naem].isOp) {
                    this.messageField.setMaxLength(500);
                }
                if (!this.announcementActive) {
                    // Check if map has changed
                    if (game.currentMap !== this.loadedMap) {
                        if (!parseMap(game.currentMap)) {
                            // Fall back to the previous map if parsing fails
                            parseMap(this.loadedMap);
                        } else {
                            this.loadedMap = game.currentMap;
                            // Start BGM for new map
                            startBGM();
                        }
                    }
                    
                    let moved = false;

                    // Update timestamp - was accidentally removed
                    // Only decrease time if not in overtime
                    if (!isOvertime) {
                        this.timestamp.setSeconds(this.timestamp.seconds() - deltaTime);
                    }
                    
                    // UI
                    this.messageField.update(commands, deltaTime);
                    this.submitButton.update(commands);
                    this.backButton.update(commands);
                    this.musicButton.update(commands);

                    if (this.musicButton.isClicked(commands)) {
                        newMusicPlay = !newMusicPlay;
                        muteBGM(!newMusicPlay);
                    }

                    if (this.backButton.isClicked(commands)) {
                        this.resetGame();
                        window.location.href = "/";
                    }

                    if (this.submitButton.isClicked(commands) || (commands.keys['Enter'] && this.messageField.isActive)) {
                        // Submit message to server
                        if (client && this.messageField.text.trim() !== "") {
                            this.messageField.deactivate();
                            // Send message directly to server - all command processing happens server-side
                            client.emit('message', `${naem} said ${this.messageField.text.trim()}`);
                            this.messageField.text = "";
                        }
                    }
                    
                    if (commands.keys['Enter'] && !this.messageField.isActive) {
                        this.messageField.activate();
                    }

                    if (commands.keys['Escape'] && this.messageField.isActive) {
                        this.messageField.deactivate();
                    }

                    if (bottomAnnouncement.active) {
                        bottomAnnouncement.timer.setSeconds(bottomAnnouncement.timer.seconds() - deltaTime);
                        if (bottomAnnouncement.timer.seconds() <= 0) {
                            bottomAnnouncement.active = false;
                        }
                    }

                    if (bottomAnnouncement.timer.seconds() <= 0) {
                        bottomAnnouncement.active = false;
                    }

                    // Update all map buttons
                    this.mapButtons.forEach((button, index) => {
                        button.update(commands);
                        
                        // Check if this button was clicked and there's a corresponding map
                        if (button.isClicked(commands) && index < mapSelection.length) {
                            const selectedMap = mapSelection[index];
                            votedFor = selectedMap;
                            
                            // First update local vote tracking
                            // Remove player from any existing votes
                            for (const map in mapVotes) {
                                if (mapVotes[map]) {
                                    mapVotes[map] = mapVotes[map].filter(player => player !== naem);
                                }
                            }
                            
                            // Initialize the selected map's vote array if needed
                            if (!mapVotes[selectedMap]) {
                                mapVotes[selectedMap] = [];
                            }
                            
                            // Add player to the selected map's votes
                            if (!mapVotes[selectedMap].includes(naem)) {
                                mapVotes[selectedMap].push(naem);
                            }
                            
                            // Inform server about the vote - use 'playerVotedFor' as that's what the server is listening for
                            if (client) {
                                client.emit('playerVotedFor', JSON.stringify({ player: naem, map: selectedMap }));
                            }
                        }
                    });

                    // Check if player is on a dashpad
                    const onDashpad = checkPlayerOnDashpad(game.players[naem]);
                    
                    // Handle dash mechanics
                    if (onDashpad) {
                        // Player is on a dashpad - just enable dash effect
                        dashActive = true;
                        dashTimeRemaining = dashDuration; // Keep refreshing dash duration
                        dashCooldownRemaining = 0;
                        // Player maintains control over direction
                    } else {
                        // Normal dash mechanics
                        if (dashCooldownRemaining > 0) {
                            dashCooldownRemaining -= deltaTime;
                        }
                        
                        if (dashActive) {
                            dashTimeRemaining -= deltaTime;
                            if (dashTimeRemaining <= 0) {
                                dashActive = false;
                            }
                        }
                        
                        // Trigger dash on spacebar press
                        if (commands.keys[' '] && dashCooldownRemaining <= 0 && !dashActive) {
                            dashActive = true;
                            dashTimeRemaining = dashDuration;
                            dashCooldownRemaining = dashCooldown;
                        }
                    }

                    // Apply movement speed (dash effect increases speed)
                    const speed = dashActive ? moveSpeed * dashMultiplier : moveSpeed;
                    
                    // Filter mapObjects to separate inside and outside objects
                    const insideObjects = [field, ...mapObjects.filter(obj => obj.collideType === 'inside')];
                    const outsideObjects = mapObjects.filter(obj => obj.collideType === 'outside');
                    
                    // Use predictMove to get valid move directions
                    const moveDirections = predictMove(game.players[naem].x, game.players[naem].y, insideObjects, outsideObjects, field);
                    
                    // Apply movement only in valid directions
                    let validX = game.players[naem].x;
                    let validY = game.players[naem].y;
                    
                    if ((commands.keys['ArrowUp'] || commands.keys['w']) && moveDirections.w) {
                        validY -= speed * deltaTime;
                    }
                    if ((commands.keys['ArrowLeft'] || commands.keys['a']) && moveDirections.a) {
                        validX -= speed * deltaTime;
                    }
                    if ((commands.keys['ArrowDown'] || commands.keys['s']) && moveDirections.s) {
                        validY += speed * deltaTime;
                    }
                    if ((commands.keys['ArrowRight'] || commands.keys['d']) && moveDirections.d) {
                        validX += speed * deltaTime;
                    }
                    
                    // Final collision check to prevent getting stuck
                    if (!canMove(validX, validY, insideObjects, outsideObjects)) {
                        validX = game.players[naem].x;
                        validY = game.players[naem].y;
                    }
                    
                    // Only update position if it changed and we're not in intermission
                    if ((validX !== game.players[naem].x || validY !== game.players[naem].y) && !intermission) {
                        game.players[naem].x = validX;
                        game.players[naem].y = validY;
                        
                        const now = performance.now();
                        if (now - lastMovementUpdate > movementUpdateRate) {
                            client.emit('move', JSON.stringify({ name: naem, x: validX, y: validY }));
                            lastMovementUpdate = now;
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
                    
                    // Cleanup expired player messages
                    const currentTime = performance.now();
                    Object.keys(playerMessages).forEach(playerName => {
                        if (currentTime - playerMessages[playerName].timestamp > MESSAGE_DISPLAY_DURATION) {
                            delete playerMessages[playerName];
                        }
                    });

                    // Handle voting timer if active
                    if (intermission && votingActive) {
                        votingTimer -= deltaTime;
                        
                        // When timer expires, choose the winning map and request map change
                        if (votingTimer <= 0) {
                            votingActive = false;
                            
                            // Determine the map with the most votes
                            let winningMap = null;
                            let highestVotes = -1;
                            
                            for (const map in mapVotes) {
                                const voteCount = mapVotes[map] ? mapVotes[map].length : 0;
                                if (voteCount > highestVotes) {
                                    highestVotes = voteCount;
                                    winningMap = map;
                                }
                            }
                            
                            // If no votes or tie, randomly select from available maps
                            if (winningMap === null && mapSelection.length > 0) {
                                winningMap = mapSelection[Math.floor(Math.random() * mapSelection.length)];
                            }
                            
                            // Request map change if we have a winning map
                            if (winningMap && client) {
                                this.requestMapChange(winningMap);
                            }
                        }
                    }

                    // Handle BGM based on game state
                    if (intermission) {
                        muteBGM(true);
                    } else if (newMusicPlay) {
                        muteBGM(false);
                    }
                }
            }
        } catch (e) {
            // Switch to dead scene and give reasoning
            console.error("Game error:", e);
            commands.globals.reason = "Client side error, may be death, for nerds: " + e.message + " " + e.stack;
            if (goToDead) {
                commands.switchScene(2);
            } else {
                commands.switchScene(0);
            }
            return;
        }
    }

    draw(ctx) {
        if (!initialized || !this.mapsLoaded) return;
        
        // Check if player exists and has required properties
        if (!game.players[naem] || 
            typeof game.players[naem].x === 'undefined' || 
            typeof game.players[naem].y === 'undefined') {
            return;
        }

        // Set camera position
        ctx.setZoom(2.5);
        ctx.setCamera(game.players[naem].x - (CANVAS_WIDTH / 2) / 2.5, game.players[naem].y - (CANVAS_HEIGHT / 2) / 2.5);
        
        // Handle outer background (outbg)
        if (field.outbgIsImage && field.outbg instanceof Image && field.outbg.complete) {
            // Draw the outer background with image pattern
            ctx.rawCtx().fillStyle = '#000000'; // Fallback color
            ctx.rawCtx().fillRect(0, 0, ctx.rawCtx().canvas.width, ctx.rawCtx().canvas.height);
            
            try {
                // Create pattern and fill background
                console.log(field.outbg)
                const pattern = ctx.rawCtx().createPattern(field.outbg, 'repeat');
                if (pattern) {
                    ctx.rawCtx().fillStyle = pattern;
                    ctx.rawCtx().fillRect(0, 0, ctx.rawCtx().canvas.width, ctx.rawCtx().canvas.height);
                }
            } catch (e) {
                console.error("Error creating pattern for outbg:", e);
                ctx.clearBackground('#918777'); // Use default if pattern creation fails
            }
        } else {
            // Use the background color for outbg
            const bgOutColor = field.outbg || '#918777';
            ctx.clearBackground(bgOutColor);
        }

        // Draw field if it exists
        if (field && field.width && field.height) {
            if (field.bgIsImage && field.bg instanceof Image && field.bg.complete) {
                // Draw field with background image
                ctx.drawRect(field.x, field.y, field.width, field.height, "#4f4d4a"); // Fallback color
                try {
                    ctx.rawCtx().drawImage(
                        field.bg, 
                        field.x - ctx.cameraX * ctx.zoom, 
                        field.y - ctx.cameraY * ctx.zoom, 
                        field.width * ctx.zoom, 
                        field.height * ctx.zoom
                    );
                } catch (e) {
                    console.error("Error drawing bg image:", e);
                }
            } else {
                // Use solid color for field background
                const fieldBg = field.bg || "#4f4d4a";
                ctx.drawRect(field.x, field.y, field.width, field.height, fieldBg);
            }
        }

        // Draw all map objects
        mapObjects.forEach(obj => {
            // Handle rotation for all object types
            const hasRotation = obj.rotation !== undefined && obj.rotation !== 0;
            
            if (obj.type === "rect") {
                if (obj.isImageColor && obj.color instanceof Image && obj.color.complete) {
                    // Draw rectangle with image fill and possible rotation
                    if (hasRotation) {
                        try {
                            // Create a temporary canvas for the rotated image rectangle
                            const tempCanvas = document.createElement('canvas');
                            const tempCtx = tempCanvas.getContext('2d');
                            tempCanvas.width = obj.width;
                            tempCanvas.height = obj.height;
                            
                            // Draw the image to the temp canvas
                            tempCtx.drawImage(obj.color, 0, 0, obj.width, obj.height);
                            
                            // Draw the rotated image
                            ctx.drawImageRotated(
                                tempCanvas,
                                obj.x, 
                                obj.y, 
                                obj.width, 
                                obj.height, 
                                obj.rotation
                            );
                        } catch (e) {
                            console.error("Error drawing rotated object image:", e);
                            // Fallback to non-rotated rectangle
                            ctx.drawRect(obj.x, obj.y, obj.width, obj.height, "#4f4d40");
                        }
                    } else {
                        // Non-rotated rectangle with image fill (original code)
                        ctx.drawRect(obj.x, obj.y, obj.width, obj.height, "#4f4d40"); // Fallback color
                        try {
                            ctx.rawCtx().drawImage(
                                obj.color,
                                obj.x - ctx.cameraX * ctx.zoom,
                                obj.y - ctx.cameraY * ctx.zoom,
                                obj.width * ctx.zoom,
                                obj.height * ctx.zoom
                            );
                        } catch (e) {
                            console.error("Error drawing object image:", e);
                        }
                    }
                } else {
                    // Solid color rectangle
                    if (hasRotation) {
                        // For rotated rectangles, we need to use a different approach
                        // Save context state
                        const rawCtx = ctx.rawCtx();
                        rawCtx.save();
                        
                        // Set up the transformation
                        const centerX = obj.x + obj.width/2;
                        const centerY = obj.y + obj.height/2;
                        const adjustedX = centerX - ctx.cameraX * ctx.zoom;
                        const adjustedY = centerY - ctx.cameraY * ctx.zoom;
                        
                        rawCtx.translate(adjustedX, adjustedY);
                        rawCtx.rotate(obj.rotation);
                        
                        // Draw the rectangle
                        rawCtx.fillStyle = obj.color;
                        rawCtx.fillRect(
                            -obj.width/2 * ctx.zoom, 
                            -obj.height/2 * ctx.zoom, 
                            obj.width * ctx.zoom, 
                            obj.height * ctx.zoom
                        );
                        
                        // Restore context
                        rawCtx.restore();
                    } else {
                        // Non-rotated rectangle (original code)
                        ctx.drawRect(obj.x, obj.y, obj.width, obj.height, obj.color);
                    }
                }
            } else if (obj.type === "image") {
                // Draw image objects with rotation if specified
                if (obj.color instanceof Image && obj.color.complete) {
                    try {
                        if (hasRotation) {
                            // Draw rotated image
                            ctx.drawImageRotated(
                                obj.color,
                                obj.x, 
                                obj.y, 
                                obj.width || obj.color.width,
                                obj.height || obj.color.height,
                                obj.rotation
                            );
                        } else {
                            // Draw non-rotated image (original code)
                            ctx.drawImage(
                                obj.color,
                                obj.x,
                                obj.y,
                                obj.width || obj.color.width,
                                obj.height || obj.color.height
                            );
                        }
                    } catch (e) {
                        console.error("Error drawing image object:", e, obj);
                        // Fallback to a colored rectangle
                        ctx.drawRect(obj.x, obj.y, obj.width || 50, obj.height || 50, "#FF00FF");
                    }
                } else {
                    // Fallback if image isn't loaded
                    ctx.drawRect(obj.x, obj.y, obj.width || 50, obj.height || 50, "#FF00FF");
                }
            }
            // Add support for other object types as needed
        });

        // Draw lobby path in bottom left
        ctx.drawText(10, CANVAS_HEIGHT - 30, `Lobby: ${lobbyPath}, Map: ${currentMapData.name}`, "white", 16, false, false);

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
                            ctx.drawLine(flag.x + flagWidth/2, flag.y + flagHeight / 9, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
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
                    // Check if player is op and use yellow color if they are
                    const playerColor = player.isOp ? "yellow" : player.color;
                    if (player.isOp && player.name === naem) {
                        this.messageField.setMaxLength(500);
                    } else if (player.isOp) {
                        this.messageField.setMaxLength(100);
                    }
                    
                    // Draw the player
                    if (player.skin && player.skin > 0 && skins[player.skin] && skins[player.skin].complete) {
                        // Draw player with skin
                        ctx.drawRect(player.x, player.y, playerWidth, playerHeight, playerColor);
                        
                        ctx.drawImage(
                            skins[player.skin],
                            player.x,
                            player.y,
                            playerWidth,
                            playerHeight
                        );
                    } else {
                        // Draw player as colored rectangle (default)
                        ctx.drawRect(player.x, player.y, playerWidth, playerHeight, playerColor);
                    }
                    
                    // Draw player name if it exists
                    if (player.name) {
                        ctx.setTextAlign("center");
                        ctx.drawText(
                            player.x + playerWidth / 2,
                            player.y - playerHeight / 2,
                            `${player.name} (${player.score || 0}, ${player.team || ""})`,
                            "white",
                            10
                        );
                        ctx.setTextAlign("left");
                        // Draw player message if exists
                        if (playerMessages[player.name]) {
                            const messageBubbleWidth = Math.min(playerMessages[player.name].text.length * 8, 200);
                            const messageBubbleHeight = 22;
                            const nameY = player.y - 20;
                            const bubbleY = nameY - messageBubbleHeight - 5; // Position 5px above name
                            
                            // Draw message bubble background
                            ctx.drawRect(
                                player.x + playerWidth/2 - messageBubbleWidth/2,
                                bubbleY,
                                messageBubbleWidth,
                                messageBubbleHeight,
                                "rgba(0, 0, 0, 0.7)"
                            );
                            
                            // Draw connecting triangle
                            const triangleSize = 6;
                            const triangleX = player.x + playerWidth/2;
                            const triangleY = bubbleY + messageBubbleHeight;
                            
                            // Use the new drawTriangle method instead of rawCtx
                            ctx.drawTriangle(
                                triangleX, triangleY + triangleSize, // Point at bottom
                                triangleX - triangleSize, triangleY, // Left corner
                                triangleX + triangleSize, triangleY, // Right corner
                                "rgba(0, 0, 0, 0.7)"
                            );
                            
                            // Draw message text
                            ctx.setTextAlign("center");
                            ctx.drawText(
                                player.x + playerWidth/2,
                                bubbleY + messageBubbleHeight/2 + 4, // Center text vertically
                                playerMessages[player.name].text.length > 25 ? 
                                    playerMessages[player.name].text.substring(0, 22) + "..." : 
                                    playerMessages[player.name].text,
                                "white",
                                12
                            );
                            ctx.setTextAlign("left");
                        }
                    }
                }
            });

            // Draw message box
            const messageBoxWidth = CANVAS_WIDTH * this.messageBoxWidthRatio;
            const messageBoxHeight = CANVAS_HEIGHT * this.messageBoxHeightRatio;
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
            const displayMessages = [...game.messages].slice(-readableMessages);
            const messageFontSize = CANVAS_HEIGHT * this.messageFontSizeRatio;
            for (let i = 0; i < displayMessages.length; i++) {
                const message = displayMessages[i];
                const messageY = (i + 1) * (messageBoxHeight / readableMessages) - 10;
                ctx.drawText(5, messageY, message, "white", messageFontSize, false, false);
            }

            // UI
            this.messageField.draw(ctx, false, false);
            this.submitButton.draw(ctx, false, false);
            this.backButton.draw(ctx, false, false);
            this.musicButton.draw(ctx, false, false);

            // Draw music button indicator
            ctx.drawText(
                this.musicButton.bounds.x + this.musicButton.bounds.width / 5,
                this.musicButton.bounds.y + this.musicButton.bounds.height - 7,
                newMusicPlay ? "✓" : "✗",
                "black",
                messageFontSize,
                false,
                false
            );

            // Draw Timer
            if (!intermission) {
                const timerBoxWidth = CANVAS_WIDTH * this.timerBoxWidthRatio;
                const timerBoxHeight = CANVAS_HEIGHT * this.timerBoxHeightRatio;
                const timerFontSize = CANVAS_HEIGHT * this.timerFontSizeRatio;

                ctx.drawRect(
                    CANVAS_WIDTH / 2 - timerBoxWidth / 2,
                    CANVAS_HEIGHT * 0.0125, // 10/800
                    timerBoxWidth,
                    timerBoxHeight,
                    "black",
                    false,
                    false
                );
                ctx.setTextAlign("center");
                
                if (isOvertime) {
                    ctx.drawText(
                        CANVAS_WIDTH / 2,
                        CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                        "OVERTIME",
                        "red",
                        timerFontSize,
                        false,
                        false
                    );
                } else {
                    ctx.drawText(
                        CANVAS_WIDTH / 2,
                        CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                        this.timestamp.string(),
                        "white",
                        timerFontSize,
                        false,
                        false
                    );
                }
                ctx.setTextAlign("left");
            } else {
                // Draw winner box
                const winnerBoxWidth = ctx.rawCtx().measureText(`${winners.player} (${winners.team})`).width + CANVAS_WIDTH * 0.0125;
                const winnerBoxHeight = CANVAS_HEIGHT * 0.0625; // 50/800
                const winnerFontSize = CANVAS_HEIGHT * this.timerFontSizeRatio;

                ctx.drawRect(
                    0,
                    0,
                    CANVAS_WIDTH,
                    CANVAS_HEIGHT,
                    "rgba(0, 0, 0, 0.5)",
                    false,
                    false
                );

                ctx.drawRect(
                    CANVAS_WIDTH / 2 - winnerBoxWidth / 2,
                    CANVAS_HEIGHT * 0.0125,
                    winnerBoxWidth,
                    winnerBoxHeight,
                    "black",
                    false,
                    false 
                );

                ctx.setTextAlign("center");
                ctx.drawText(
                    CANVAS_WIDTH / 2,
                    CANVAS_HEIGHT * 0.0125 + winnerBoxHeight / 2,
                    `${winners.player} (${winners.team})`,
                    "white",
                    winnerFontSize,
                    false,
                    false
                );

                ctx.setTextAlign("left");

                if (winners.team === game.players[naem].team) {
                    const voteFontSize = CANVAS_HEIGHT * this.voteFontSizeRatio;
                    const voteTimerFontSize = CANVAS_HEIGHT * this.voteTimerFontSizeRatio;

                    ctx.drawText(
                        CANVAS_WIDTH / 2,
                        CANVAS_HEIGHT * 0.5,
                        "Select a map",
                        "white",
                        voteFontSize,
                        false,
                        false
                    );

                    this.mapButtons.forEach((button, index) => {
                        if (index < mapSelection.length) {
                            button.label = mapSelection[index] || `Map ${index+1}`;
                            button.draw(ctx, false, false);
                        }
                    });

                    let voteYPosition = CANVAS_HEIGHT * 0.5 + CANVAS_HEIGHT * 0.0625;
                    
                    for (let i = 0; i < mapSelection.length; i++) {
                        const voteCount = mapVotes[mapSelection[i]] ? mapVotes[mapSelection[i]].length : 0;
                        ctx.drawText(
                            CANVAS_WIDTH / 2,
                            voteYPosition,
                            `${mapSelection[i]}: ${voteCount} votes`,
                            "white",
                            voteFontSize,
                            false,
                            false
                        );
                        voteYPosition += CANVAS_HEIGHT * 0.025;
                    }

                    if (votingActive) {
                        const timeLeft = Math.ceil(votingTimer);
                        const timerText = `Next map in: ${timeLeft} seconds`;
                        ctx.drawText(
                            CANVAS_WIDTH / 2,
                            CANVAS_HEIGHT * 0.3,
                            timerText,
                            timeLeft <= 3 ? "red" : "white",
                            voteTimerFontSize,
                            false,
                            false
                        );
                    }
                } else {
                    ctx.drawText(
                        CANVAS_WIDTH / 2,
                        CANVAS_HEIGHT * 0.5,
                        "Waiting for next game...",
                        "white",
                        CANVAS_HEIGHT * this.voteFontSizeRatio,
                        false,
                        false
                    );
                }
            }
        }

        // Draw announcement overlay if active
        if (this.announcementActive) {
            ctx.drawRect(
                0,
                0,
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
                "rgba(0, 0, 0, 0.7)",
                false,
                false
            );
            
            ctx.setTextAlign("center");
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT / 2,
                this.announcementText,
                "white",
                CANVAS_HEIGHT * this.announcementFontSizeRatio,
                false,
                false
            );
            ctx.setTextAlign("left");
        }
        
        // Draw bottom announcement if active
        if (bottomAnnouncement.active) {
            ctx.drawRect(
                0,
                CANVAS_HEIGHT - (CANVAS_HEIGHT / 4),
                CANVAS_WIDTH,
                CANVAS_HEIGHT / 4,
                "rgba(0, 0, 0, 0.7)",
                false,
                false
            );
            ctx.setTextAlign("center");
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT - (CANVAS_HEIGHT / 5) + CANVAS_HEIGHT * 0.05,
                bottomAnnouncement.header,
                "yellow",
                CANVAS_HEIGHT * (this.announcementFontSizeRatio * 2),
                false,
                false
            );
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT - (CANVAS_HEIGHT / 5) + CANVAS_HEIGHT * 0.1,
                bottomAnnouncement.body,
                "#ccad58",
                CANVAS_HEIGHT * (this.announcementFontSizeRatio),
                false,
                false
            );
            ctx.setTextAlign("left");
        }
    }

    // Add a method to request map change
    requestMapChange(mapName) {
        if (client && mapName) {
            console.log(`Requesting map change to: ${mapName}`);
            client.emit('changeMap', JSON.stringify({ mapName: mapName }));
        }
    }
}

export class deadScene extends Scene {
    reason = "";
    showTechnicalDetails = false;
    // Define UI ratios
    buttonWidthRatio = 0.1875; // 300/1600
    buttonHeightRatio = 0.075; // 60/800
    titleFontSizeRatio = 0.0625; // 50/800
    subtitleFontSizeRatio = 0.0375; // 30/800
    detailsFontSizeRatio = 0.0225; // 18/800

    constructor() {
        super();
        this.init();
    }

    init() {
        const buttonWidth = CANVAS_WIDTH * this.buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * this.buttonHeightRatio;
        
        this.detailsButton = new OCtxButton(
            CANVAS_WIDTH / 2 - buttonWidth / 2,
            CANVAS_HEIGHT * 0.4,
            buttonWidth,
            buttonHeight,
            "Show Technical Details"
        );
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
        
        const titleFontSize = CANVAS_HEIGHT * this.titleFontSizeRatio;
        const subtitleFontSize = CANVAS_HEIGHT * this.subtitleFontSizeRatio;
        const detailsFontSize = CANVAS_HEIGHT * this.detailsFontSizeRatio;
        
        // Main death message
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166,
            CANVAS_HEIGHT * 0.1,
            "You are dead.",
            "white",
            titleFontSize
        );
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166,
            CANVAS_HEIGHT * 0.2,
            "Press Enter to reload and pick a new name.",
            "white",
            subtitleFontSize
        );
        
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
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166,
            CANVAS_HEIGHT * 0.3,
            userFriendlyReason,
            "white",
            subtitleFontSize
        );
        
        // Draw the details button
        this.detailsButton.draw(ctx);
        
        // Display technical details only when showTechnicalDetails is true
        if (this.showTechnicalDetails && technicalDetails !== "") {
            const lines = technicalDetails.split('\n');
            for (let i = 0; i < lines.length; i++) {
                ctx.drawText(
                    20,
                    CANVAS_HEIGHT * 0.5 + (i * CANVAS_HEIGHT * 0.0375),
                    lines[i],
                    "#aaaaaa",
                    detailsFontSize
                );
            }
        }
    }
}

// Update the check function to handle null or undefined objects gracefully
function checkPlayerOnDashpad(player) {
    if (!player || typeof player !== 'object') return false;
    
    for (const obj of mapObjects) {
        try {
            if (obj && obj.property && obj.property.dashpad === true) {
                if (checkCollision(
                    { x: player.x, y: player.y, width: playerWidth, height: playerHeight },
                    obj
                )) {
                    return true; // Player is on a dashpad
                }
            }
        } catch (e) {
            console.error("Error checking dashpad collision:", e);
            // Continue checking other objects instead of failing completely
        }
    }
    return false; // Not on a dashpad
}

// Add BGM control functions
function startBGM() {
    const currentMap = game.currentMap;
    if (audio.maps[currentMap] && audio.maps[currentMap].bgm) {
        audio.maps[currentMap].bgm.loop = true;
        audio.maps[currentMap].bgm.play().catch(e => console.log("BGM play failed:", e));
    }
}

function muteBGM(mute) {
    Object.values(audio.maps).forEach(map => {
        if (map.bgm) {
            map.bgm.muted = mute;
        }
    });
}