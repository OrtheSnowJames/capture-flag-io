// SPDX-License-Identifier: MIT
import { OCtxButton } from "../../../context-engine.mjs";
import { CANVAS_WIDTH, CANVAS_HEIGHT, naem } from "../../../script.js";
import { state } from "../../state.js";

export function setupDeadOverlay(scene) {
    const buttonWidth = CANVAS_WIDTH * scene.deadButtonWidthRatio;
    const buttonHeight = CANVAS_HEIGHT * scene.deadButtonHeightRatio;
    const arrowWidth = CANVAS_WIDTH * scene.deadArrowWidthRatio;
    const spacing = CANVAS_WIDTH * 0.02;
    const rowY = CANVAS_HEIGHT * 0.82;

    const totalWidth = arrowWidth + buttonWidth + buttonWidth + arrowWidth + spacing * 3;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;

    scene.deadLeftButton = new OCtxButton(
        startX,
        rowY,
        arrowWidth,
        buttonHeight,
        "←"
    );

    scene.deadRespawnButton = new OCtxButton(
        startX + arrowWidth + spacing,
        rowY,
        buttonWidth,
        buttonHeight,
        "Respawn"
    );

    scene.deadLeaveButton = new OCtxButton(
        startX + arrowWidth + spacing + buttonWidth + spacing,
        rowY,
        buttonWidth,
        buttonHeight,
        "Leave"
    );

    scene.deadRightButton = new OCtxButton(
        startX + arrowWidth + spacing + buttonWidth + spacing + buttonWidth + spacing,
        rowY,
        arrowWidth,
        buttonHeight,
        "→"
    );

    scene.deadLeftButton.setColors("#122236", "#1A3556", "#0F1C2D", "#73B2FF", "#EEF6FF");
    scene.deadRightButton.setColors("#122236", "#1A3556", "#0F1C2D", "#73B2FF", "#EEF6FF");
    scene.deadRespawnButton.setColors("#1B3D2A", "#24553A", "#153123", "#8CE0A6", "#F1FFF6");
    scene.deadLeaveButton.setColors("#3A1C22", "#512731", "#2C1419", "#FF8EA1", "#FFF0F3");

    scene.deadLeftButton.cornerRadius = 10;
    scene.deadRightButton.cornerRadius = 10;
    scene.deadRespawnButton.cornerRadius = 10;
    scene.deadLeaveButton.cornerRadius = 10;
}

function getSpectatorTargets() {
    return Object.values(state.game.players).filter(player => player && player.name);
}

export function syncSpectatorTarget(forceFirst) {
    const targets = getSpectatorTargets();
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

function cycleSpectator(delta) {
    const targets = getSpectatorTargets();
    if (targets.length === 0) return;

    let index = targets.findIndex(player => player.name === state.spectatorTargetName);
    if (index === -1) index = 0;
    index = (index + delta + targets.length) % targets.length;

    state.spectatorTargetIndex = index;
    state.spectatorTargetName = targets[index].name;
}

export function updateDeadOverlay(scene, commands) {
    syncSpectatorTarget(false);

    scene.deadLeftButton.update(commands);
    scene.deadRightButton.update(commands);
    scene.deadRespawnButton.update(commands);
    scene.deadLeaveButton.update(commands);

    if (scene.deadLeftButton.isClicked(commands) || commands.keys['ArrowLeft']) {
        cycleSpectator(-1);
    }

    if (scene.deadRightButton.isClicked(commands) || commands.keys['ArrowRight']) {
        cycleSpectator(1);
    }

    if (scene.deadRespawnButton.isClicked(commands)) {
        if (state.client && !state.respawnPending) {
            console.log(`[DBG][client-respawn-click] local=${naem}`);
            state.client.emit('respawn', JSON.stringify({ name: naem }));
            state.respawnPending = true;
        }
    }

    if (scene.deadLeaveButton.isClicked(commands)) {
        scene.resetGame();
        window.location.href = "/";
    }
}

export function drawDeadOverlay(scene, ctx) {
    syncSpectatorTarget(false);

    ctx.setCamera(0, 0);
    ctx.setZoom(1);

    const titleFontSize = CANVAS_HEIGHT * scene.deadTitleFontSizeRatio;

    ctx.setTextAlign("center");
    ctx.drawRoundedRectFill(
        CANVAS_WIDTH * 0.27,
        CANVAS_HEIGHT * 0.65,
        CANVAS_WIDTH * 0.46,
        CANVAS_HEIGHT * 0.23,
        14,
        "rgba(7, 20, 34, 0.78)",
        false,
        false
    );
    ctx.drawText(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT * 0.72,
        "You died!",
        "white",
        titleFontSize
    );

    scene.deadLeftButton.draw(ctx);
    scene.deadRespawnButton.draw(ctx);
    scene.deadLeaveButton.draw(ctx);
    scene.deadRightButton.draw(ctx);

    ctx.setTextAlign("left");
}
