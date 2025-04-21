// SPDX-License-Identifier: MIT
import { otherCtx, contextEngine, Commands, Scene, OCtxButton, OCtxTextField } from "./context-engine.mjs";
import { gameScene, deadScene } from "./game.js";

// filepath: /home/james/Documents/capture-flag-io/node/public/script/script.js

export let naem = ""; // Exported variable to hold the player's name
export let lobbyPath = ""; // Exported variable to hold the lobby path
let switched = false;
export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 800;
const PORT = 4566;
let coverart = new Image();
coverart.src = "/assets/coverart.png";

function namefieldPlaceholderError(error, namefield) {
    namefield.deactivate();
    namefield.text = "";
    namefield.setPlaceholder(error);
}

class menuScene extends Scene {
    #loading = false;            // private flag to avoid re‑entry

    constructor() {
        super();
        this.init();
    }

    async onLoad(commands) {}

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


    update(dt, commands) {
      if (switched || this.#loading) return;
  
      this.startButton.update(commands);
      this.nameField.update(commands, dt);
  
      if (!this.startButton.isClicked(commands)) return;
  
      const entered = this.nameField.getText().trim();
      if (!entered) {
        namefieldPlaceholderError("Please enter a name", this.nameField);
        return;
      }
  
      this.#loading = true;      // lock until we finish
      (async () => {
        try {
          const { path } = await fetch(`/lobby`).then(r => r.json());
          lobbyPath = path;
  
          const { available } = await fetch(
            `/check-name?name=${encodeURIComponent(entered)}&lobby=${lobbyPath}`
          ).then(r => r.json());
  
          if (!available) {
            namefieldPlaceholderError("Name already taken", this.nameField);
            this.#loading = false;
            return;
          }
  
          naem = entered;
          this.nameField.deactivate();
          commands.switchScene(1);
          switched = true;
        } catch (err) {
          console.error(err);
          namefieldPlaceholderError("Server error – try again", this.nameField);
          this.#loading = false;
        }
      })();                      // immediately‑invoked async function
    }

    draw(ctx) {
        if (switched) {
            return;
        }
        ctx.setCamera(0, 0);
        ctx.clearBackground('black');
        ctx.drawImage(coverart, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.startButton.draw(ctx);
        this.nameField.draw(ctx);
        ctx.drawText(
            CANVAS_WIDTH / 2 - CANVAS_WIDTH * 0.166, // 16.6% of canvas width offset 
            CANVAS_HEIGHT * 0.2, // 10% of canvas height from the top
            "Welcome to capture-flag-io!!1",
            "white",
            50
        );
    }
}

export class timeData {
  constructor(timeInSeconds) {
    this.milliseconds = timeInSeconds * 1000;
  }

  seconds() {
    return this.milliseconds / 1000;
  }

  setSeconds(seconds) {
    this.milliseconds = seconds * 1000;
  }

  minutes() {
    return this.seconds() / 60;
  }

  setMinutes(minutes) {
    this.milliseconds = minutes * 60 * 1000;
  }

  hours() {
    return this.minutes() / 60;
  }

  setHours(hours) {
    this.milliseconds = hours * 60 * 60 * 1000;
  }

  days() {
    return this.hours() / 24;
  }

  setDays(days) {
    this.milliseconds = days * 24 * 60 * 60 * 1000;
  }

  months() {
    return this.days() / 30;
  }

  setMonths(months) {
    this.milliseconds = months * 30 * 24 * 60 * 60 * 1000;
  }

  years() {
    return this.days() / 365;
  }

  setYears(years) {
    this.milliseconds = years * 365 * 24 * 60 * 60 * 1000;
  }

  string() {
    const totalSeconds = Math.floor(this.seconds());
    const years = Math.floor(totalSeconds / (365 * 24 * 60 * 60));
    const months = Math.floor((totalSeconds % (365 * 24 * 60 * 60)) / (30 * 24 * 60 * 60));
    const days = Math.floor((totalSeconds % (30 * 24 * 60 * 60)) / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    let timeString = '';
    if (years > 0) timeString += `${years}y `;
    if (months > 0) timeString += `${months}m `;
    if (days > 0) timeString += `${days}d `;
    if (hours > 0) timeString += `${hours}:`;
    timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return timeString;
  }

  setFromString(timeString) {
    if (!timeString) return;
    
    // Parse the time string
    let totalSeconds = 0;
    
    // Handle years
    let match = timeString.match(/(\d+)y/);
    if (match) totalSeconds += parseInt(match[1]) * 365 * 24 * 60 * 60;
    
    // Handle months
    match = timeString.match(/(\d+)m/);
    if (match) totalSeconds += parseInt(match[1]) * 30 * 24 * 60 * 60;
    
    // Handle days
    match = timeString.match(/(\d+)d/);
    if (match) totalSeconds += parseInt(match[1]) * 24 * 60 * 60;
    
    // Handle time in HH:MM:SS format
    const timeMatch = timeString.match(/(\d+)?:?(\d{2}):(\d{2})$/);
    if (timeMatch) {
      const hours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseInt(timeMatch[3]);
      
      totalSeconds += hours * 60 * 60 + minutes * 60 + seconds;
    }
    
    this.setSeconds(totalSeconds);
  }
}

let menuSceneObj = new menuScene();
let gameSceneObj = new gameScene();
let deadSceneObj = new deadScene();

let game = [menuSceneObj, gameSceneObj, deadSceneObj];

contextEngine(game, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // call the engine