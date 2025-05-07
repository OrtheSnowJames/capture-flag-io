// SPDX-License-Identifier: MIT
import { otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField } from "./context-engine.mjs";
import { gameScene, deadScene, goToDead } from "./game.js";

// filepath: /home/james/Documents/capture-flag-io/node/public/script/script.js

export let naem = "";
export let lobbyPath = "";
export let privcode = "";
let switched = false;
let tips = [];
export let engine = null;
// Load tips asynchronously
fetch("/assets/loadingScreenTips.json")
  .then(response => response.json())
  .then(data => {
    tips = data;
  })
  .catch(error => console.error("Error loading tips:", error));

let randomTip = "";

setTimeout(() => {
  randomTip = tips.length > 0 ? 
  tips[Math.floor(Math.random() * tips.length)] : 
  "Pro tip: Wait for tips to load!";
}, 300);

export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 700;
export let musicPlay = false;
musicPlay = true;
const PORT = 4566;
let coverart = new Image();
coverart.src = "/assets/coverart.png";

let titleMusic = new Audio("/assets/music/evansong2.wav");
titleMusic.loop = true;
if (musicPlay) {
  titleMusic.play();
}

function namefieldPlaceholderError(error, namefield) {
    namefield.deactivate();
    namefield.text = "";
    namefield.setPlaceholder(error);
}

class menuScene extends Scene {
    #loading = false;            // private flag to avoid re‑entry
    // Define UI ratios
    buttonWidthRatio = 0.25; // 400/1600
    buttonHeightRatio = 0.083; // 66.4/800
    nameFieldWidthRatio = 0.25; // 400/1600
    nameFieldHeightRatio = 0.083; // 66.4/800
    titleFontSizeRatio = 0.0625; // 50/800
    tipFontSizeRatio = 0.0125; // 10/800
    musicIndicatorFontSizeRatio = 0.025; // 20/800
    buttonSpacingRatio = 0.125; // 100/800
    backButtonXRatio = 0.03125; // 50/1600

    constructor() {
        super();
        this.init();
        this.titleSize = CANVAS_HEIGHT * this.titleFontSizeRatio;
        this.titleAnimationTime = 0;
        this.titleAnimationSpeed = 1/30; // One cycle per 30 seconds
    }

    async onLoad(commands) {
        goToDead = true;
    }

    init() {
        const buttonWidth = CANVAS_WIDTH * this.buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * this.buttonHeightRatio;
        const nameFieldWidth = CANVAS_WIDTH * this.nameFieldWidthRatio;
        const nameFieldHeight = CANVAS_HEIGHT * this.nameFieldHeightRatio;

        this.startButton = new OCtxButton(
            CANVAS_WIDTH / 2 - buttonWidth / 2,
            CANVAS_HEIGHT / 2,
            buttonWidth,
            buttonHeight,
            "Start Game"
        );

        this.nameField = new OCtxTextField(
            CANVAS_WIDTH / 2 - nameFieldWidth / 2,
            CANVAS_HEIGHT / 2 - CANVAS_HEIGHT * 0.166,
            nameFieldWidth,
            nameFieldHeight,
            Math.round(nameFieldWidth/23)
        );

        this.backButton = new OCtxButton(
            CANVAS_WIDTH * this.backButtonXRatio,
            CANVAS_HEIGHT * 0.0625,
            buttonWidth,
            buttonHeight,
            "Back"
        );

        this.musicButton = new OCtxButton(
            CANVAS_WIDTH * this.backButtonXRatio,
            CANVAS_HEIGHT * 0.1875,
            buttonWidth,
            buttonHeight,
            "Music Toggle"
        );

        this.privateButton = new OCtxButton(
            CANVAS_WIDTH * this.backButtonXRatio,
            CANVAS_HEIGHT * 0.3125,
            buttonWidth,
            buttonHeight,
            "Private Host"
        );

        this.privateJoinButton = new OCtxButton(
            CANVAS_WIDTH * this.backButtonXRatio,
            CANVAS_HEIGHT * 0.4375,
            buttonWidth,
            buttonHeight,
            "Private Join"
        );

        this.nameField.setPlaceholder("Enter your name");
    }

    update(dt, commands) {
        if (switched || this.#loading) return;
  
        this.startButton.update(commands);
        this.nameField.update(commands, dt);
        this.backButton.update(commands);
        this.musicButton.update(commands);
        this.privateButton.update(commands);
        this.privateJoinButton.update(commands);
        
        // Update title animation using deltaTime
        this.titleAnimationTime += dt;
        // Use sine wave to oscillate between 40 and 50, with proper time scaling
        this.titleSize = CANVAS_HEIGHT * (0.05625 + 0.00625 * Math.sin(this.titleAnimationTime * this.titleAnimationSpeed * Math.PI));

        if (this.backButton.isClicked(commands)) {
            window.location.href = "/";
        }

        if (this.musicButton.isClicked(commands)) {
            musicPlay = !musicPlay;
            titleMusic.muted = !musicPlay;
        }

        if (this.privateJoinButton.isClicked(commands)) {
            commands.switchScene(3);
        }
  
        let startButtonClicked = this.startButton.isClicked(commands);
        let privateButtonClicked = this.privateButton.isClicked(commands);

        if (!startButtonClicked && !privateButtonClicked) return;
  
        const entered = this.nameField.getText().trim();
        if (!entered) {
            namefieldPlaceholderError("Please enter a name", this.nameField);
            return;
        }
        
        // Check for spaces in name
        if (entered.includes(' ')) {
            namefieldPlaceholderError("Names cannot contain spaces", this.nameField);
            return;
        }
  
        this.#loading = true;
        if (startButtonClicked) {
            console.log("not private");
            (async () => {
                try {
                    const { path } = await fetch(`/lobby`).then(r => r.json());
                    lobbyPath = path;
        
                    const response = await fetch(
                        `/check-name?name=${encodeURIComponent(entered)}&lobby=${lobbyPath}`
                    ).then(r => r.json());
        
                    if (!response.available) {
                        const errorMessage = response.reason || "Name already taken";
                        namefieldPlaceholderError(errorMessage, this.nameField);
                        this.#loading = false;
                        return;
                    }
        
                    naem = entered;
                    this.nameField.deactivate();
                    commands.switchScene(1);
                    titleMusic.pause();
                    switched = true;
                } catch (err) {
                    console.error(err);
                    namefieldPlaceholderError("Server error – try again", this.nameField);
                    this.#loading = false;
                }
            })();
        } else if (privateButtonClicked) {
            console.log("private");
            (async () => {
                try {
                    const { path, privcodee } = await fetch(`/lobby/newlobby`).then(r => r.json());
                    lobbyPath = path;
                    await console.log(lobbyPath);
                    privcode = privcodee;
                    // check name
                    const response = await fetch(
                        `/check-name?name=${encodeURIComponent(entered)}&lobby=${lobbyPath}`
                    ).then(r => r.json());

                    if (!response.available) {
                        namefieldPlaceholderError("Name already taken", this.nameField);
                        this.#loading = false;
                        return;
                    }

                    naem = entered;
                    this.nameField.deactivate();
                    commands.switchScene(1);
                    titleMusic.pause();
                    switched = true;
                } catch (err) {
                    console.error(err);
                    namefieldPlaceholderError("Server error – try again", this.nameField);
                    this.#loading = false;
                }
            })();
        }
    }

    draw(ctx) {
        ctx.setCamera(0, 0);
        ctx.setZoom(1);
        ctx.clearBackground('black');
        ctx.drawImage(coverart, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw title with animated size
        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.2,
            "Welcome to capture-flag-io!!1",
            "white",
            this.titleSize
        );
        ctx.setTextAlign("left");

        // pick a random tip from the tips array
        const tipFontSize = CANVAS_HEIGHT * this.tipFontSizeRatio;
        ctx.rawCtx().font = `${CANVAS_HEIGHT * this.titleFontSizeRatio}px Arial`;
        ctx.drawTextRotated(
            CANVAS_WIDTH / 2 + ctx.rawCtx().measureText("Welcome to capture-flag-io!!1").width * 0.166 + CANVAS_WIDTH * 0.125,
            CANVAS_HEIGHT * 0.2 + CANVAS_HEIGHT * 0.05,
            randomTip,
            "yellow",
            tipFontSize,
            -Math.PI / 4
        );

        this.startButton.draw(ctx);
        this.nameField.draw(ctx);
        this.backButton.draw(ctx);
        this.musicButton.draw(ctx);
        this.privateButton.draw(ctx);
        this.privateJoinButton.draw(ctx);
        
        // draw a check/x near the button
        const musicIndicatorFontSize = CANVAS_HEIGHT * this.musicIndicatorFontSizeRatio;
        ctx.drawText(
            this.musicButton.bounds.x + this.musicButton.bounds.width / 5,
            this.musicButton.bounds.y + this.musicButton.bounds.height / 2 + CANVAS_HEIGHT * 0.0125,
            musicPlay ? "✓" : "✗",
            "black",
            musicIndicatorFontSize
        );
    }
}

class privateJoinScene extends Scene {
    // Define UI ratios
    buttonWidthRatio = 0.125; // 200/1600
    buttonHeightRatio = 0.0625; // 50/800
    fieldWidthRatio = 0.125; // 200/1600
    fieldHeightRatio = 0.0625; // 50/800
    titleFontSizeRatio = 0.0625; // 50/800
    backButtonXRatio = 0.03125; // 50/1600
    backButtonYRatio = 0.25; // 200/800

    constructor() {
        super();
        this.init();
    }

    init() {
        const buttonWidth = CANVAS_WIDTH * this.buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * this.buttonHeightRatio;
        const fieldWidth = CANVAS_WIDTH * this.fieldWidthRatio;
        const fieldHeight = CANVAS_HEIGHT * this.fieldHeightRatio;

        this.backButton = new OCtxButton(
            CANVAS_WIDTH * this.backButtonXRatio,
            CANVAS_HEIGHT * this.backButtonYRatio,
            buttonWidth,
            buttonHeight,
            "Back"
        );

        this.nameField = new OCtxTextField(
            CANVAS_WIDTH / 2 - fieldWidth / 2,
            CANVAS_HEIGHT / 2 - fieldHeight - CANVAS_HEIGHT * 0.0625,
            fieldWidth,
            fieldHeight,
            Math.round(fieldWidth/23)
        );

        this.lobbyPathField = new OCtxTextField(
            CANVAS_WIDTH / 2 - fieldWidth / 2,
            CANVAS_HEIGHT / 2 + CANVAS_HEIGHT * 0.0625,
            fieldWidth,
            fieldHeight,
            Math.round(fieldWidth/23)
        );

        this.startButton = new OCtxButton(
            CANVAS_WIDTH / 2 - buttonWidth / 2,
            CANVAS_HEIGHT / 2 + CANVAS_HEIGHT * 0.125,
            buttonWidth,
            buttonHeight,
            "Start"
        );

        this.nameField.setPlaceholder("Enter your name");
        this.nameField.maxLength = 12;
        this.lobbyPathField.setPlaceholder("Enter the lobby path");
        this.lobbyPathField.maxLength = 12;
    }

    update(dt, commands) {
        this.backButton.update(commands);
        this.nameField.update(commands, dt);
        this.lobbyPathField.update(commands, dt);
        this.startButton.update(commands);
        if (this.backButton.isClicked(commands)) {
            commands.switchScene(0);
        }

        if (this.startButton.isClicked(commands)) {
            console.log("start button clicked");
            (async () => {
                try {
                    const path = await this.lobbyPathField.getText();
                    lobbyPath = path;
        
                    const response = await fetch(
                        `/check-name?name=${encodeURIComponent(this.nameField.text)}&lobby=${lobbyPath}`
                    ).then(r => r.json());
        
                    if (!response.available) {
                        const errorMessage = response.reason || "Name already taken";
                        namefieldPlaceholderError(errorMessage, this.nameField);
                        return;
                    }
        
                    naem = this.nameField.text;
                    this.nameField.deactivate();
                    commands.switchScene(1);
                    titleMusic.pause();
                    switched = true;
                } catch (err) {
                    console.error(err);
                    namefieldPlaceholderError("Server error – try again", this.nameField);
                }
            })();
        }
    }
    
    draw(ctx) {
        ctx.setCamera(0, 0);
        ctx.setZoom(1);
        ctx.clearBackground('black');
        ctx.drawImage(coverart, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        const titleFontSize = CANVAS_HEIGHT * this.titleFontSizeRatio;
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166,
            CANVAS_HEIGHT * 0.1,
            "Private Join",
            "white",
            titleFontSize
        );
        
        this.backButton.draw(ctx);
        this.nameField.draw(ctx);
        this.lobbyPathField.draw(ctx);
        this.startButton.draw(ctx);
    }
}

let menuSceneObj = new menuScene();
let gameSceneObj = new gameScene();
let deadSceneObj = new deadScene();
let privateJoinSceneObj = new privateJoinScene();

let game = [menuSceneObj, gameSceneObj, deadSceneObj, privateJoinSceneObj];

engine = contextEngine(game, 0, CANVAS_WIDTH, CANVAS_HEIGHT, true); // call the engine