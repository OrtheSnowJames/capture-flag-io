// SPDX-License-Identifier: MIT
import { naem, CANVAS_WIDTH, CANVAS_HEIGHT } from "../script.js";
import { state } from "./state.js";
import { CAMERA_ZOOM, GRENADE_PICKUP_RADIUS, GRENADE_PROJECTILE_RADIUS } from "./constants.js";
import { checkCollision } from "./utils.js";

const pickupRetryIntervalMs = 300;
const throwPickupBlockMs = 200;
const multiHeldLogIntervalMs = 1000;

let lastThrowTime = 0;
let lastMultiHeldLogTime = 0;

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

function getHeldItemsForPlayer(playerName) {
    return state.items.filter(item => item.state === "held" && item.heldBy === playerName);
}

function normalizeHeldItemsForPlayer(player, heldItems) {
    if (heldItems.length <= 1) return heldItems[0] || null;

    const now = performance.now();
    if (now - lastMultiHeldLogTime > multiHeldLogIntervalMs) {
        lastMultiHeldLogTime = now;
        console.warn(`[grenade] multiple held items detected for ${player.name}`);
    }

    const primary = state.lastHeldItemId
        ? heldItems.find(item => item.id === state.lastHeldItemId) || heldItems[0]
        : heldItems[0];

    state.items = state.items.map(item => {
        if (item.heldBy !== player.name || item.id === primary.id) return item;
        return {
            ...item,
            state: "ground",
            heldBy: null,
            x: player.x,
            y: player.y
        };
    });

    return primary;
}

function getHeldItem() {
    const heldItems = getHeldItemsForPlayer(naem);
    const player = state.game.players[naem];
    if (!player) return null;

    const heldItem = normalizeHeldItemsForPlayer(player, heldItems);
    if (heldItem && state.lastHeldItemId !== heldItem.id) {
        state.lastHeldItemId = heldItem.id;
        console.log(`[grenade] picked up item ${heldItem.id}`);
    }
    if (!heldItem && state.lastHeldItemId !== null) {
        state.lastHeldItemId = null;
    }
    return heldItem;
}

function clearInvalidPendingPickup() {
    if (!state.pendingPickupItemId) return;
    const pendingItem = state.items.find(item => item.id === state.pendingPickupItemId);
    if (!pendingItem || pendingItem.state !== "ground") {
        state.pendingPickupItemId = null;
    }
}

function findHoveredGroundItem(player) {
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
    return hoveredItem;
}

function updateHoverState(hoveredItem) {
    const hoveredItemId = hoveredItem ? hoveredItem.id : null;
    if (hoveredItemId !== state.lastHoverItemId) {
        state.lastHoverItemId = hoveredItemId;
        if (hoveredItemId !== null) {
            console.log(`[grenade] hover item ${hoveredItemId}`);
        }
    }
}

function requestPickupIfNeeded(hoveredItem) {
    if (!hoveredItem) {
        state.pendingPickupItemId = null;
        return;
    }

    const now = performance.now();
    const isSameItem = state.lastPickupRequestItemId === hoveredItem.id;
    if (state.pendingPickupItemId !== hoveredItem.id || !isSameItem || now - state.lastPickupRequestTime > pickupRetryIntervalMs) {
        state.pendingPickupItemId = hoveredItem.id;
        state.lastPickupRequestItemId = hoveredItem.id;
        state.lastPickupRequestTime = now;
        console.log(`[grenade] pickup request for item ${hoveredItem.id}`);
        state.client?.emit('itemPickup', JSON.stringify({ itemId: hoveredItem.id }));
    }
}

function handleGroundItems(player) {
    if (performance.now() - lastThrowTime < throwPickupBlockMs) return;

    const hoveredItem = findHoveredGroundItem(player);
    updateHoverState(hoveredItem);
    requestPickupIfNeeded(hoveredItem);
}

function updateHeldOrbit(heldItem, player, commands) {
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    
    const { worldX, worldY } = getWorldCursorPosition(commands);
    const angle = Math.atan2(worldY - cy, worldX - cx);
    heldItem.orbitAngle = angle;

    const now = performance.now();
    if (now - state.lastOrbitUpdateTime > 150) {
        state.lastOrbitUpdateTime = now;
        state.client?.emit('itemOrbit', JSON.stringify({ itemId: heldItem.id, angle }));
    }

    return { worldX, worldY };
}

function tryThrowHeldItem(scene, heldItem, player, worldX, worldY, commands) {
    if (!commands || !commands.mouseReleased || scene.messageField?.isActive) return;

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
    lastThrowTime = performance.now();
}

export function handleGrenades(scene, commands) {
    if (!state.items || !state.items.length) return;

    const player = state.game.players[naem];
    if (!player) return;

    clearInvalidPendingPickup();

    const heldItem = getHeldItem();
    if (!heldItem) {
        handleGroundItems(player);
        return;
    }

    state.pendingPickupItemId = null;

    const { worldX, worldY } = updateHeldOrbit(heldItem, player, commands);
    tryThrowHeldItem(scene, heldItem, player, worldX, worldY, commands);
}

export function handleProjectileCollisions() {
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

export function updateLocalProjectiles(deltaTime) {
    if (!state.localProjectiles.length) return;
    const now = performance.now();
    state.localProjectiles = state.localProjectiles.filter(projectile => {
        projectile.x += projectile.vx * deltaTime;
        projectile.y += projectile.vy * deltaTime;
        return now - projectile.spawnTime < 3000;
    });
}
