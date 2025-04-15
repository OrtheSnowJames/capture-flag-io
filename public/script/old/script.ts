import {otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField} from "./context-engine.js";

import { gameScene } from "./game.js";

export let naem = ""; // Exported variable to hold the player's name
let switched = false;
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 800;
const PORT = 4566;
function namefieldPlaceholderError(error: string, namefield: OCtxTextField) {
    namefield.deactivate();
    namefield.text = "";
    namefield.setPlaceholder(error);
}

class menuScene extends Scene {
    private startButton!: OCtxButton;
    private nameField!: OCtxTextField;
    constructor() {
        super();
        this.init();
    }

    init() {
        const buttonWidthRatio = 0.25; // 25% of canvas width
        const buttonHeightRatio = 0.083; // 8.3% of canvas height
        const nameFieldWidthRatio = 0.25; // 25% of canvas width
        const nameFieldHeightRatio = 0.083; // 8.3% of canvas height

        const buttonWidth = CANVAS_WIDTH * buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * buttonHeightRatio;
        const nameFieldWidth = CANVAS_WIDTH * nameFieldWidthRatio;
        const nameFieldHeight = CANVAS_HEIGHT * nameFieldHeightRatio;

        this.startButton = new OCtxButton(
            CANVAS_WIDTH / 2 - buttonWidth / 2,
            CANVAS_HEIGHT / 2,
            buttonWidth,
            buttonHeight,
            "Start Game"
        );

        this.nameField = new OCtxTextField(
            CANVAS_WIDTH / 2 - nameFieldWidth / 2,
            CANVAS_HEIGHT / 2 - CANVAS_HEIGHT * 0.166, // 16.6% of canvas height above the button
            nameFieldWidth,
            nameFieldHeight,
            20
        );
        this.nameField.setPlaceholder("Enter your name");
    }

    update(deltaTime: number, commands: Commands) {
        if (switched) {
            return;
        }
        this.startButton.update(commands);
        this.nameField.update(commands, deltaTime);

        if (this.startButton.isPressed) {
            if (this.nameField.getText().length > 0) {
                const enteredName = this.nameField.getText();
                fetch(`http://localhost:${PORT}/check-name?name=${enteredName}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Network response was not ok");
                        }
                        return response.json();
                    })
                    .then(data => {
                        if ((data as { available: boolean }).available) {
                            // Name is available, proceed with the game
                            console.log("Name is available!");
                            naem = enteredName; // Assign the entered name to the exported `naem` variable
                            this.nameField.deactivate();
                            console.log("Name is: " + naem);
                            commands.switchScene(1); // Switch to the game scene
                            switched = true;
                        } else {
                            namefieldPlaceholderError("Name already taken", this.nameField);
                        }
                    })
                    .catch(error => {
                        console.error("There was a problem with the fetch operation:", error);
                    });
            } else {
                namefieldPlaceholderError("Please enter a name", this.nameField);
            }
        }
    }

    draw(ctx: otherCtx) {
        if (switched) {
            return;
        }
        ctx.setCamera(0, 0);
        ctx.clearBackground('black');
        this.startButton.draw(ctx);
        this.nameField.draw(ctx);
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, // 16.6% of canvas width offset
            CANVAS_HEIGHT * 0.1, // 10% of canvas height from the top
            "Welcome to capture-flag-io!!1",
            "white",
            50
        );
    }
}

let menuSceneObj = new menuScene();
let gameSceneObj = new gameScene();

let game = [menuSceneObj, gameSceneObj];

contextEngine(game, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // call the engine