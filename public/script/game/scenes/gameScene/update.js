// SPDX-License-Identifier: MIT
import { naem } from "../../../script.js";
import { state } from "../../state.js";
import {
    moveSpeed,
    dashMultiplier,
    dashDuration,
    dashCooldown,
    movementUpdateRate,
    MESSAGE_DISPLAY_DURATION,
    flagHeight
} from "../../constants.js";
import { parseMap } from "../../maps.js";
import { predictMove, canMove, checkPlayerOnDashpad } from "../../movement.js";
import { lerp } from "../../utils.js";
import { startBGM, muteBGM } from "../../assets.js";
import { updateUI } from "./ui.js";

function updateMovement(scene, deltaTime, commands) {
    const onDashpad = checkPlayerOnDashpad(state.game.players[naem]);

    if (onDashpad) {
        state.dashActive = true;
        state.dashTimeRemaining = dashDuration;
        state.dashCooldownRemaining = 0;
    } else {
        if (state.dashCooldownRemaining > 0) {
            state.dashCooldownRemaining -= deltaTime;
        }

        if (state.dashActive) {
            state.dashTimeRemaining -= deltaTime;
            if (state.dashTimeRemaining <= 0) {
                state.dashActive = false;
            }
        }

        const dashInput = commands.keys[' '] || (scene.isMobile && scene.mobileButtonStates.dash);
        if (dashInput && state.dashCooldownRemaining <= 0 && !state.dashActive) {
            state.dashActive = true;
            state.dashTimeRemaining = dashDuration;
            state.dashCooldownRemaining = dashCooldown;
        }
    }

    const speed = state.dashActive ? moveSpeed * dashMultiplier : moveSpeed;

    const insideObjects = [state.field, ...state.mapObjects.filter(obj => obj.collideType === 'inside')];
    const outsideObjects = state.mapObjects.filter(obj => obj.collideType === 'outside');

    const moveDirections = predictMove(naem, state.game.players[naem].x, state.game.players[naem].y, insideObjects, outsideObjects);

    let validX = state.game.players[naem].x;
    let validY = state.game.players[naem].y;

    const upInput = commands.keys['ArrowUp'] || commands.keys['w'] || (scene.isMobile && scene.mobileButtonStates.up);
    const leftInput = commands.keys['ArrowLeft'] || commands.keys['a'] || (scene.isMobile && scene.mobileButtonStates.left);
    const downInput = commands.keys['ArrowDown'] || commands.keys['s'] || (scene.isMobile && scene.mobileButtonStates.down);
    const rightInput = commands.keys['ArrowRight'] || commands.keys['d'] || (scene.isMobile && scene.mobileButtonStates.right);

    if (upInput && moveDirections.w) {
        validY -= speed * deltaTime;
    }
    if (leftInput && moveDirections.a) {
        validX -= speed * deltaTime;
    }
    if (downInput && moveDirections.s) {
        validY += speed * deltaTime;
    }
    if (rightInput && moveDirections.d) {
        validX += speed * deltaTime;
    }

    if (!canMove(naem, validX, validY, insideObjects, outsideObjects)) {
        validX = state.game.players[naem].x;
        validY = state.game.players[naem].y;
    }

    if ((validX !== state.game.players[naem].x || validY !== state.game.players[naem].y) && !state.intermission) {
        state.game.players[naem].x = validX;
        state.game.players[naem].y = validY;

        const now = performance.now();
        if (now - state.lastMovementUpdate > movementUpdateRate) {
            state.client.emit('move', JSON.stringify({ name: naem, x: validX, y: validY }));
            state.lastMovementUpdate = now;
        }
    }

    Object.keys(state.game.players).forEach(playerName => {
        if (playerName !== naem) {
            const player = state.game.players[playerName];
            player.interpolationTime += deltaTime * 5;

            if (player.interpolationTime > 1) player.interpolationTime = 1;

            player.x = lerp(player.prevX, player.targetX, player.interpolationTime);
            player.y = lerp(player.prevY, player.targetY, player.interpolationTime);
        }
    });

    Object.keys(state.game.flags).forEach(flagName => {
        const flag = state.game.flags[flagName];
        if (flag.interpolationTime !== undefined) {
            flag.interpolationTime += deltaTime * 5;

            if (flag.interpolationTime > 1) flag.interpolationTime = 1;

            if (!flag.capturedBy) {
                flag.x = lerp(flag.prevX, flag.targetX, flag.interpolationTime);
                flag.y = lerp(flag.prevY, flag.targetY, flag.interpolationTime);
            } else if (state.game.players[flag.capturedBy]) {
                const player = state.game.players[flag.capturedBy];
                flag.x = player.x;
                flag.y = player.y - flagHeight / 2;
            }
        }
    });
}

function updateVoting(scene, deltaTime) {
    if (state.intermission && state.votingActive) {
        state.votingTimer -= deltaTime;

        if (state.votingTimer <= 0) {
            state.votingActive = false;

            let winningMap = null;
            let highestVotes = -1;

            for (const map in state.mapVotes) {
                const voteCount = state.mapVotes[map] ? state.mapVotes[map].length : 0;
                if (voteCount > highestVotes) {
                    highestVotes = voteCount;
                    winningMap = map;
                }
            }

            if (winningMap === null && state.mapSelection.length > 0) {
                winningMap = state.mapSelection[Math.floor(Math.random() * state.mapSelection.length)];
            }

            if (winningMap && state.client) {
                scene.requestMapChange(winningMap);
            }
        }
    }
}

export function updateGameScene(scene, deltaTime, commands) {
    if (!state.initialized || !scene.mapsLoaded) return;
    if (!state.game.players[naem]) return;

    if (scene.announcementActive) {
        scene.announcementTimer -= deltaTime;
        if (scene.announcementTimer <= 0) {
            scene.announcementActive = false;
            scene.announcementText = "";
        }
    }

    if (state.game.players[naem].isOp) {
        scene.messageField.setMaxLength(500);
    }

    if (scene.announcementActive) {
        return;
    }

    if (state.game.currentMap !== scene.loadedMap) {
        if (!parseMap(state.game.currentMap)) {
            parseMap(scene.loadedMap);
        } else {
            scene.loadedMap = state.game.currentMap;
            startBGM();
        }
    }

    if (!state.isOvertime) {
        scene.timestamp.setSeconds(scene.timestamp.seconds() - deltaTime);
    }

    updateUI(scene, commands, deltaTime);
    updateMovement(scene, deltaTime, commands);

    const currentTime = performance.now();
    Object.keys(state.playerMessages).forEach(playerName => {
        if (currentTime - state.playerMessages[playerName].timestamp > MESSAGE_DISPLAY_DURATION) {
            delete state.playerMessages[playerName];
        }
    });

    updateVoting(scene, deltaTime);

    if (state.intermission) {
        muteBGM(true);
    } else if (state.newMusicPlay) {
        muteBGM(false);
    }
}
