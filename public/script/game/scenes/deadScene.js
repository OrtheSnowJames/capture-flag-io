// SPDX-License-Identifier: MIT
import { Scene, OCtxButton } from "../../context-engine.mjs";
import { CANVAS_WIDTH, CANVAS_HEIGHT, engine, naem } from "../../script.js";
import { state } from "../state.js";

export class deadScene extends Scene {
    buttonWidthRatio = 0.16;
    buttonHeightRatio = 0.075;
    arrowButtonWidthRatio = 0.06;
    titleFontSizeRatio = 0.04;
    subtitleFontSizeRatio = 0.0225;

    constructor() {
        super();
        this.init();
    }

    init() {
        const buttonWidth = CANVAS_WIDTH * this.buttonWidthRatio;
        const buttonHeight = CANVAS_HEIGHT * this.buttonHeightRatio;
        const arrowWidth = CANVAS_WIDTH * this.arrowButtonWidthRatio;
        const spacing = CANVAS_WIDTH * 0.02;
        const rowY = CANVAS_HEIGHT * 0.82;

        const totalWidth = arrowWidth + buttonWidth + buttonWidth + arrowWidth + spacing * 3;
        const startX = CANVAS_WIDTH / 2 - totalWidth / 2;

        this.leftButton = new OCtxButton(
            startX,
            rowY,
            arrowWidth,
            buttonHeight,
            "←"
        );

        this.respawnButton = new OCtxButton(
            startX + arrowWidth + spacing,
            rowY,
            buttonWidth,
            buttonHeight,
            "Respawn"
        );

        this.leaveButton = new OCtxButton(
            startX + arrowWidth + spacing + buttonWidth + spacing,
            rowY,
            buttonWidth,
            buttonHeight,
            "Leave"
        );

        this.rightButton = new OCtxButton(
            startX + arrowWidth + spacing + buttonWidth + spacing + buttonWidth + spacing,
            rowY,
            arrowWidth,
            buttonHeight,
            "→"
        );
    }

    async onLoad(commands) {
        this.commands = commands;
        state.dead = true;
        this.syncSpectatorTarget(true);
    }
    async onExit(commands) {}

    getSpectatorTargets() {
        return Object.values(state.game.players).filter(player => player && player.name);
    }

    syncSpectatorTarget(forceFirst) {
        const targets = this.getSpectatorTargets();
        if (targets.length === 0) {
            state.spectatorTargetName = null;
            state.spectatorTargetIndex = 0;
            return;
        }

        const existingIndex = targets.findIndex(player => player.name === state.spectatorTargetName);
        if (existingIndex !== -1 && !forceFirst) {
            state.spectatorTargetIndex = existingIndex;
            return;
        }

        state.spectatorTargetIndex = 0;
        state.spectatorTargetName = targets[0].name;
    }

    cycleSpectator(delta) {
        const targets = this.getSpectatorTargets();
        if (targets.length === 0) return;

        let index = targets.findIndex(player => player.name === state.spectatorTargetName);
        if (index === -1) index = 0;
        index = (index + delta + targets.length) % targets.length;

        state.spectatorTargetIndex = index;
        state.spectatorTargetName = targets[index].name;
    }

    update(deltaTime, commands) {
        this.syncSpectatorTarget(false);
        this.leftButton.update(commands);
        this.rightButton.update(commands);
        this.respawnButton.update(commands);
        this.leaveButton.update(commands);

        if (this.leftButton.isClicked(commands) || commands.keys['ArrowLeft']) {
            this.cycleSpectator(-1);
        }

        if (this.rightButton.isClicked(commands) || commands.keys['ArrowRight']) {
            this.cycleSpectator(1);
        }

        if (this.respawnButton.isClicked(commands)) {
            if (state.client) {
                state.client.emit('respawn', JSON.stringify({ name: naem }));
            }
            state.dead = false;
            state.spectatorTargetName = null;
            state.spectatorTargetIndex = 0;
            commands.switchScene(1);
        }

        if (this.leaveButton.isClicked(commands)) {
            const gameScene = engine?.scenes?.[1];
            if (gameScene && gameScene.resetGame) {
                gameScene.resetGame();
            }
            window.location.href = "/";
        }
    }

    draw(ctx) {
        ctx.setCamera(0, 0);
        ctx.setZoom(1);
        ctx.clearBackground('black');

        const gameScene = engine?.scenes?.[1];
        if (gameScene && gameScene.draw) {
            gameScene.draw(ctx);
        }

        ctx.setCamera(0, 0);
        ctx.setZoom(1);

        const titleFontSize = CANVAS_HEIGHT * this.titleFontSizeRatio;

        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.72,
            "You died!",
            "white",
            titleFontSize
        );

        this.leftButton.draw(ctx);
        this.respawnButton.draw(ctx);
        this.leaveButton.draw(ctx);
        this.rightButton.draw(ctx);

        ctx.setTextAlign("left");
    }
}
