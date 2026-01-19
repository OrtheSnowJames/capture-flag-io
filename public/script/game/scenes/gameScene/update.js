// SPDX-License-Identifier: MIT
import { naem, CANVAS_WIDTH, CANVAS_HEIGHT } from "../../../script.js";
import { state } from "../../state.js";
import {
    moveSpeed,
    dashMultiplier,
    dashDuration,
    dashCooldown,
    movementUpdateRate,
    MESSAGE_DISPLAY_DURATION,
    flagHeight,
    CAMERA_ZOOM,
    GRENADE_PICKUP_RADIUS,
    GRENADE_PROJECTILE_RADIUS
} from "../../constants.js";
import { parseMap } from "../../maps.js";
import { predictMove, canMove, checkPlayerOnDashpad } from "../../movement.js";
import { lerp, checkCollision } from "../../utils.js";
import { startBGM, muteBGM } from "../../assets.js";
import { updateUI } from "./ui.js";
import { GamePhase, isIntermissionPhase, isPlayingPhase } from "../../enums.js";

function updatePlayerInterpolations(deltaTime, includeLocal) {
    Object.keys(state.game.players).forEach(playerName => {
        if (!includeLocal && playerName === naem) {
            return;
        }
        const player = state.game.players[playerName];
        if (!player) return;
        player.interpolationTime += deltaTime * 5;

        if (player.interpolationTime > 1) player.interpolationTime = 1;

        player.x = lerp(player.prevX, player.targetX, player.interpolationTime);
        player.y = lerp(player.prevY, player.targetY, player.interpolationTime);
    });
}

function updateFlagInterpolations(deltaTime) {
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

function getWorldCursorPosition(commands) {
    const player = state.game.players[naem];
    const cameraX = player.x - (CANVAS_WIDTH / 2) / CAMERA_ZOOM;
    const cameraY = player.y - (CANVAS_HEIGHT / 2) / CAMERA_ZOOM;
    const worldX = commands?.mouseX !== undefined
        ? (commands.mouseX / CAMERA_ZOOM) + cameraX
        : player.x;
    const worldY = commands?.mouseY !== undefined
        ? (commands.mouseY / CAMERA_ZOOM) + cameraY
        : player.y;
    return { worldX, worldY };
}

function handleGrenades(scene, commands) {
    if (!state.items || !state.items.length) return;

    const player = state.game.players[naem];
    if (!player) return;

    if (state.pendingPickupItemId) {
        const pendingItem = state.items.find(item => item.id === state.pendingPickupItemId);
        if (!pendingItem || pendingItem.state !== "ground") {
            state.pendingPickupItemId = null;
        }
    }

    const heldItem = state.items.find(item => item.state === "held" && item.heldBy === naem);
    if (heldItem && state.lastHeldItemId !== heldItem.id) {
        state.lastHeldItemId = heldItem.id;
        console.log(`[grenade] picked up item ${heldItem.id}`);
    }
    if (!heldItem && state.lastHeldItemId !== null) {
        state.lastHeldItemId = null;
    }
    if (!heldItem) {
        let hoveredItem = null;
        let hoveredDistance = Infinity;
        for (const item of state.items) {
            if (item.state !== "ground") continue;
            const dx = item.x - player.x;
            const dy = item.y - player.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= GRENADE_PICKUP_RADIUS && distance < hoveredDistance) {
                hoveredItem = item;
                hoveredDistance = distance;
            }
        }

        const hoveredItemId = hoveredItem ? hoveredItem.id : null;
        if (hoveredItemId !== state.lastHoverItemId) {
            state.lastHoverItemId = hoveredItemId;
            if (hoveredItemId !== null) {
                console.log(`[grenade] hover item ${hoveredItemId}`);
            }
        }

        if (!hoveredItem) {
            state.pendingPickupItemId = null;
            return;
        }

        const now = performance.now();
        const isSameItem = state.lastPickupRequestItemId === hoveredItem.id;
        if (state.pendingPickupItemId !== hoveredItem.id || !isSameItem || now - state.lastPickupRequestTime > 800) {
            state.pendingPickupItemId = hoveredItem.id;
            state.lastPickupRequestItemId = hoveredItem.id;
            state.lastPickupRequestTime = now;
            console.log(`[grenade] pickup request for item ${hoveredItem.id}`);
            state.client?.emit('itemPickup', JSON.stringify({ itemId: hoveredItem.id }));
        }
        return;
    }

    state.pendingPickupItemId = null;

    const { worldX, worldY } = getWorldCursorPosition(commands);
    const angle = Math.atan2(worldY - player.y, worldX - player.x);
    heldItem.orbitAngle = angle;

    const now = performance.now();
    if (now - state.lastOrbitUpdateTime > 150) {
        state.lastOrbitUpdateTime = now;
        state.client?.emit('itemOrbit', JSON.stringify({ itemId: heldItem.id, angle }));
    }

    if (commands && commands.mouseReleased && !scene.messageField?.isActive) {
        console.log(`[grenade] throw item ${heldItem.id} to ${worldX.toFixed(1)},${worldY.toFixed(1)}`);
        const dx = worldX - player.x;
        const dy = worldY - player.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const speed = 400;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        const clientId = state.nextClientProjectileId++;

        state.localProjectiles.push({
            clientId,
            type: heldItem.type,
            x: player.x,
            y: player.y,
            vx,
            vy,
            spawnTime: performance.now()
        });
        state.items = state.items.filter(item => item.id !== heldItem.id);

        state.client?.emit('itemThrow', JSON.stringify({ itemId: heldItem.id, targetX: worldX, targetY: worldY, clientId }));
    }
}

function handleProjectileCollisions() {
    if (!state.projectiles || state.projectiles.length === 0) return;

    for (const projectile of state.projectiles) {
        for (const obj of state.mapObjects) {
            if (obj.collideType !== 'outside') continue;
            const hit = checkCollision(
                {
                    x: projectile.x - GRENADE_PROJECTILE_RADIUS,
                    y: projectile.y - GRENADE_PROJECTILE_RADIUS,
                    width: GRENADE_PROJECTILE_RADIUS * 2,
                    height: GRENADE_PROJECTILE_RADIUS * 2
                },
                obj
            );
            if (hit) {
                state.client?.emit('itemDetonate', JSON.stringify({ projectileId: projectile.id, x: projectile.x, y: projectile.y }));
                break;
            }
        }
    }
}

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

    if ((validX !== state.game.players[naem].x || validY !== state.game.players[naem].y) && isPlayingPhase(state.phase)) {
        state.game.players[naem].x = validX;
        state.game.players[naem].y = validY;

        const now = performance.now();
        if (now - state.lastMovementUpdate > movementUpdateRate) {
            state.client.emit('move', JSON.stringify({ name: naem, x: validX, y: validY }));
            state.lastMovementUpdate = now;
        }
    }

    updatePlayerInterpolations(deltaTime, false);
    updateFlagInterpolations(deltaTime);
}

function updateVoting(scene, deltaTime) {
    if (state.phase === GamePhase.VOTING) {
        state.votingTimer -= deltaTime;

        if (state.votingTimer <= 0) {
            state.phase = GamePhase.INTERMISSION;

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

function updateLocalProjectiles(deltaTime) {
    if (!state.localProjectiles.length) return;
    const now = performance.now();
    state.localProjectiles = state.localProjectiles.filter(projectile => {
        projectile.x += projectile.vx * deltaTime;
        projectile.y += projectile.vy * deltaTime;
        return now - projectile.spawnTime < 3000;
    });
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

    if (state.phase !== GamePhase.OVERTIME) {
        scene.timestamp.setSeconds(scene.timestamp.seconds() - deltaTime);
    }

    updateUI(scene, commands, deltaTime);
    handleGrenades(scene, commands);
    updateMovement(scene, deltaTime, commands);
    handleProjectileCollisions();
    updateLocalProjectiles(deltaTime);

    const currentTime = performance.now();
    Object.keys(state.playerMessages).forEach(playerName => {
        if (currentTime - state.playerMessages[playerName].timestamp > MESSAGE_DISPLAY_DURATION) {
            delete state.playerMessages[playerName];
        }
    });

    updateVoting(scene, deltaTime);

    if (isIntermissionPhase(state.phase)) {
        muteBGM(true);
    } else if (state.newMusicPlay) {
        muteBGM(false);
    }
}

export function tickSpectator(scene, deltaTime) {
    if (!state.initialized || !scene.mapsLoaded) return;

    if (scene.announcementActive) {
        scene.announcementTimer -= deltaTime;
        if (scene.announcementTimer <= 0) {
            scene.announcementActive = false;
            scene.announcementText = "";
        }
    }

    if (state.game.currentMap !== scene.loadedMap) {
        if (!parseMap(state.game.currentMap)) {
            parseMap(scene.loadedMap);
        } else {
            scene.loadedMap = state.game.currentMap;
            startBGM();
        }
    }

    if (state.phase !== GamePhase.OVERTIME) {
        scene.timestamp.setSeconds(scene.timestamp.seconds() - deltaTime);
    }

    updatePlayerInterpolations(deltaTime, true);
    updateFlagInterpolations(deltaTime);
    handleProjectileCollisions();
    updateLocalProjectiles(deltaTime);

    const currentTime = performance.now();
    Object.keys(state.playerMessages).forEach(playerName => {
        if (currentTime - state.playerMessages[playerName].timestamp > MESSAGE_DISPLAY_DURATION) {
            delete state.playerMessages[playerName];
        }
    });

    updateVoting(scene, deltaTime);

    if (isIntermissionPhase(state.phase)) {
        muteBGM(true);
    } else if (state.newMusicPlay) {
        muteBGM(false);
    }
}
