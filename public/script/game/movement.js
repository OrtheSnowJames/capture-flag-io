// SPDX-License-Identifier: MIT
import { state } from "./state.js";
import { playerWidth, playerHeight } from "./constants.js";
import { checkCollision } from "./utils.js";

export function predictMove(playerName, x, y, objectsinside = [], objectsoutside = []) {
    const player = state.game.players[playerName];
    if (!player) return { w: false, a: false, s: false, d: false };

    const moveDirections = { w: true, a: true, s: true, d: true };
    const testStep = 10;

    const testPositions = {
        w: { x: x, y: y - testStep },
        a: { x: x - testStep, y: y },
        s: { x: x, y: y + testStep },
        d: { x: x + testStep, y: y }
    };

    for (const [direction, pos] of Object.entries(testPositions)) {
        if (pos.x < 0 || pos.x + playerWidth > state.field.width ||
            pos.y < 0 || pos.y + playerHeight > state.field.height) {
            moveDirections[direction] = false;
            continue;
        }

        for (const obj of objectsoutside) {
            if (checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                obj
            )) {
                moveDirections[direction] = false;
                break;
            }
        }

        if (!moveDirections[direction]) continue;

        for (const obj of objectsinside) {
            if (!checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
            )) {
                moveDirections[direction] = false;
                break;
            }
        }

        if (!moveDirections[direction]) continue;

        for (const obj of state.mapObjects) {
            const isAlreadyChecked = [...objectsinside, ...objectsoutside].some(checkedObj =>
                checkedObj.x === obj.x &&
                checkedObj.y === obj.y &&
                checkedObj.width === obj.width &&
                checkedObj.height === obj.height
            );

            if (isAlreadyChecked) continue;

            const isColliding = checkCollision(
                { x: pos.x, y: pos.y, width: playerWidth, height: playerHeight },
                obj
            );

            if (isColliding && obj.property && obj.property.teamblock) {
                if (obj.property.teamblock !== player.team) {
                    moveDirections[direction] = false;
                    break;
                }
            }

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

export function canMove(playerName, x, y, objectsinside = [], objectsoutside = []) {
    const player = state.game.players[playerName];
    if (!player) return false;

    if (x < 0 || x + playerWidth > state.field.width || y < 0 || y + playerHeight > state.field.height) {
        return false;
    }

    for (const obj of objectsoutside) {
        if (checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            obj
        )) {
            return false;
        }
    }

    for (const obj of objectsinside) {
        if (!checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
        )) {
            return false;
        }
    }

    for (const obj of state.mapObjects) {
        const isAlreadyChecked = [...objectsinside, ...objectsoutside].some(checkedObj =>
            checkedObj.x === obj.x &&
            checkedObj.y === obj.y &&
            checkedObj.width === obj.width &&
            checkedObj.height === obj.height
        );

        if (isAlreadyChecked) continue;

        const isColliding = checkCollision(
            { x: x, y: y, width: playerWidth, height: playerHeight },
            obj
        );

        if (isColliding && obj.property && obj.property.teamblock) {
            if (obj.property.teamblock !== player.team) {
                return false;
            }
        }

        if (obj.collideType === 'outside' && isColliding) {
            return false;
        } else if (obj.collideType === 'inside' && !isColliding) {
            return false;
        }
    }

    return true;
}

export function checkPlayerOnDashpad(player) {
    if (!player || typeof player !== 'object') return false;

    for (const obj of state.mapObjects) {
        try {
            if (obj && obj.property && obj.property.dashpad === true) {
                if (checkCollision(
                    { x: player.x, y: player.y, width: playerWidth, height: playerHeight },
                    obj
                )) {
                    return true;
                }
            }
        } catch (e) {
            console.error("Error checking dashpad collision:", e);
        }
    }
    return false;
}
