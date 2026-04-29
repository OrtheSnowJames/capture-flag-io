// SPDX-License-Identifier: MIT
import { CANVAS_WIDTH, CANVAS_HEIGHT, lobbyPath, naem } from "../../../script.js";
import { state } from "../../state.js";
import { PlayerLife } from "../../enums.js";
import { skins, redFlagImage, blueFlagImage } from "../../assets.js";
import { playerWidth, playerHeight, flagWidth, flagHeight, CAMERA_ZOOM, GRENADE_ORBIT_RADIUS, GRENADE_PROJECTILE_RADIUS, SMOKE_RADIUS, EXPLOSION_RADIUS } from "../../constants.js";

export function drawWorld(scene, ctx) {
    if (!state.initialized || !scene.mapsLoaded) return false;

    let cameraTargetName = state.life === PlayerLife.DEAD ? state.spectatorTargetName : naem;
    let cameraTarget = cameraTargetName ? state.game.players[cameraTargetName] : null;
    if (!cameraTarget) {
        const fallbackPlayer = Object.values(state.game.players)[0];
        if (fallbackPlayer) {
            cameraTargetName = fallbackPlayer.name;
            cameraTarget = fallbackPlayer;
            if (state.life === PlayerLife.DEAD) {
                state.spectatorTargetName = cameraTargetName;
                state.spectatorTargetIndex = 0;
            }
        }
    }
    if (!cameraTarget ||
        typeof cameraTarget.x === 'undefined' ||
        typeof cameraTarget.y === 'undefined') {
        if (state.life === PlayerLife.DEAD) {
            // If everyone is dead/disconnected, keep rendering with a stable fallback
            // so the death overlay can still be shown.
            cameraTarget = {
                x: state.field.x + state.field.width / 2,
                y: state.field.y + state.field.height / 2
            };
        } else {
            console.error("Camera target not found");
            return false;
        }
    }

    ctx.setZoom(CAMERA_ZOOM);
    ctx.setCamera(cameraTarget.x - (CANVAS_WIDTH / 2) / CAMERA_ZOOM, cameraTarget.y - (CANVAS_HEIGHT / 2) / CAMERA_ZOOM);

    if (state.field.outbgIsImage && state.field.outbg instanceof Image && state.field.outbg.complete) {
        ctx.rawCtx().fillStyle = '#000000';
        ctx.rawCtx().fillRect(0, 0, ctx.rawCtx().canvas.width, ctx.rawCtx().canvas.height);

        try {
            console.log(state.field.outbg);
            const pattern = ctx.rawCtx().createPattern(state.field.outbg, 'repeat');
            if (pattern) {
                ctx.rawCtx().fillStyle = pattern;
                ctx.rawCtx().fillRect(0, 0, ctx.rawCtx().canvas.width, ctx.rawCtx().canvas.height);
            }
        } catch (e) {
            console.error("Error creating pattern for outbg:", e);
            ctx.clearBackground('#918777');
        }
    } else {
        const bgOutColor = state.field.outbg || '#918777';
        ctx.clearBackground(bgOutColor);
    }

    if (state.field && state.field.width && state.field.height) {
        if (state.field.bgIsImage && state.field.bg instanceof Image && state.field.bg.complete) {
            ctx.drawRect(state.field.x, state.field.y, state.field.width, state.field.height, "#4f4d4a");
            try {
                ctx.rawCtx().drawImage(
                    state.field.bg,
                    state.field.x - ctx.cameraX * ctx.zoom,
                    state.field.y - ctx.cameraY * ctx.zoom,
                    state.field.width * ctx.zoom,
                    state.field.height * ctx.zoom
                );
            } catch (e) {
                console.error("Error drawing bg image:", e);
            }
        } else {
            const fieldBg = state.field.bg || "#4f4d4a";
            ctx.drawRect(state.field.x, state.field.y, state.field.width, state.field.height, fieldBg);
        }
    }

    state.mapObjects.forEach(obj => {
        const hasRotation = obj.rotation !== undefined && obj.rotation !== 0;

        if (obj.type === "rect") {
            if (obj.isImageColor && obj.color instanceof Image && obj.color.complete) {
                if (hasRotation) {
                    try {
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCanvas.width = obj.width;
                        tempCanvas.height = obj.height;

                        tempCtx.drawImage(obj.color, 0, 0, obj.width, obj.height);

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
                        ctx.drawRect(obj.x, obj.y, obj.width, obj.height, "#4f4d40");
                    }
                } else {
                    ctx.drawRect(obj.x, obj.y, obj.width, obj.height, "#4f4d40");
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
                if (hasRotation) {
                    const rawCtx = ctx.rawCtx();
                    rawCtx.save();

                    const centerX = obj.x + obj.width / 2;
                    const centerY = obj.y + obj.height / 2;
                    const adjustedX = centerX - ctx.cameraX * ctx.zoom;
                    const adjustedY = centerY - ctx.cameraY * ctx.zoom;

                    rawCtx.translate(adjustedX, adjustedY);
                    rawCtx.rotate(obj.rotation);

                    rawCtx.fillStyle = obj.color;
                    rawCtx.fillRect(
                        -obj.width / 2 * ctx.zoom,
                        -obj.height / 2 * ctx.zoom,
                        obj.width * ctx.zoom,
                        obj.height * ctx.zoom
                    );

                    rawCtx.restore();
                } else {
                    ctx.drawRect(obj.x, obj.y, obj.width, obj.height, obj.color);
                }
            }
        } else if (obj.type === "image") {
            if (obj.color instanceof Image && obj.color.complete) {
                try {
                    if (hasRotation) {
                        ctx.drawImageRotated(
                            obj.color,
                            obj.x,
                            obj.y,
                            obj.width || obj.color.width,
                            obj.height || obj.color.height,
                            obj.rotation
                        );
                    } else {
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
                    ctx.drawRect(obj.x, obj.y, obj.width || 50, obj.height || 50, "#FF00FF");
                }
            } else {
                ctx.drawRect(obj.x, obj.y, obj.width || 50, obj.height || 50, "#FF00FF");
            }
        }
    });

    if (state.items && state.items.length > 0) {
        state.items.forEach(item => {
            const color = item.type === "frag" ? "rgba(0, 200, 0, 0.95)" : "rgba(200, 200, 200, 0.9)";
            if (item.state === "ground") {
                ctx.drawCircle(item.x, item.y, 10, color);
            } else if (item.state === "held" && item.heldBy && state.game.players[item.heldBy]) {
                const holder = state.game.players[item.heldBy];
                const angle = item.orbitAngle || 0;
                const orbitX = holder.x + Math.cos(angle) * GRENADE_ORBIT_RADIUS;
                const orbitY = holder.y + Math.sin(angle) * GRENADE_ORBIT_RADIUS;
                ctx.drawCircle(orbitX, orbitY, 10, color);
            }
        });
    }

    if (state.projectiles && state.projectiles.length > 0) {
        state.projectiles.forEach(projectile => {
            const color = projectile.type === "frag" ? "rgba(0, 200, 0, 0.9)" : "rgba(180, 180, 180, 0.9)";
            ctx.drawCircle(projectile.x, projectile.y, GRENADE_PROJECTILE_RADIUS, color);
        });
    }

    if (state.localProjectiles && state.localProjectiles.length > 0) {
        state.localProjectiles.forEach(projectile => {
            const color = projectile.type === "frag" ? "rgba(0, 220, 0, 0.9)" : "rgba(200, 200, 200, 0.9)";
            ctx.drawCircle(projectile.x, projectile.y, GRENADE_PROJECTILE_RADIUS, color);
        });
    }

    ctx.drawText(10, CANVAS_HEIGHT - 30, `Lobby: ${lobbyPath}, Map: ${state.currentMapData.name}`, "white", 16, false, false);

    if (state.game.flags) {
        Object.values(state.game.flags).forEach(flag => {
            if (flag && typeof flag.x !== 'undefined' && typeof flag.y !== 'undefined') {
                const isCaptured = flag.capturedBy && state.game.players[flag.capturedBy];
                if (isCaptured) {
                    const player = state.game.players[flag.capturedBy];
                    flag.x = player.x + playerWidth / 2 - flagWidth / 2;
                    flag.y = player.y + playerHeight / 2 - flagHeight / 2;
                }

                const flagImage = flag.team === "red" ? redFlagImage : blueFlagImage;
                if (isCaptured) {
                    ctx.drawImageRotated(flagImage, flag.x, flag.y, flagWidth, flagHeight, Math.PI / 12);
                } else {
                    ctx.drawImageScaled(flagImage, flag.x, flag.y, flagWidth, flagHeight);
                }

                /*
                if (flag.capturedBy) {
                    const player = state.game.players[flag.capturedBy];
                    if (player && player.x && player.y) {
                        ctx.drawLine(flag.x + flagWidth / 2, flag.y + flagHeight / 9, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
                    }
                }
                */
            }
        });
    }

    const isPlayerInSmoke = (player) => {
        if (!state.smokeClouds || state.smokeClouds.length === 0) return false;
        return state.smokeClouds.some(cloud => {
            const dx = player.x - cloud.x;
            const dy = player.y - cloud.y;
            return Math.hypot(dx, dy) <= SMOKE_RADIUS;
        });
    };

    if (state.game.players) {
        Object.values(state.game.players).forEach(player => {
            if (player &&
                typeof player.x !== 'undefined' &&
                typeof player.y !== 'undefined' &&
                player.color) {
                const playerColor = player.isOp ? "yellow" : player.color;
                if (state.life === PlayerLife.ALIVE) {
                    if (player.isOp && player.name === naem) {
                        scene.messageField.setMaxLength(500);
                    } else if (player.isOp) {
                        scene.messageField.setMaxLength(100);
                    }
                }

                if (player.skin && player.skin > 0 && skins[player.skin] && skins[player.skin].complete) {
                    ctx.drawRect(player.x, player.y, playerWidth, playerHeight, playerColor);

                    ctx.drawImage(
                        skins[player.skin],
                        player.x,
                        player.y,
                        playerWidth,
                        playerHeight
                    );
                } else {
                    ctx.drawRect(player.x, player.y, playerWidth, playerHeight, playerColor);
                    }

                    if (player.name && !isPlayerInSmoke(player)) {
                        ctx.setTextAlign("center");
                        ctx.drawText(
                            player.x + playerWidth / 2,
                            player.y - playerHeight / 2,
                        `${player.name} (${player.score || 0}, ${player.team || ""})`,
                        "white",
                        10
                    );
                    ctx.setTextAlign("left");
                    if (state.playerMessages[player.name]) {
                        const messageBubbleWidth = Math.min(state.playerMessages[player.name].text.length * 8, 200);
                        const messageBubbleHeight = 22;
                        const nameY = player.y - 20;
                        const bubbleY = nameY - messageBubbleHeight - 5;

                        ctx.drawRect(
                            player.x + playerWidth / 2 - messageBubbleWidth / 2,
                            bubbleY,
                            messageBubbleWidth,
                            messageBubbleHeight,
                            "rgba(0, 0, 0, 0.7)"
                        );

                        const triangleSize = 6;
                        const triangleX = player.x + playerWidth / 2;
                        const triangleY = bubbleY + messageBubbleHeight;

                        ctx.drawTriangle(
                            triangleX, triangleY + triangleSize,
                            triangleX - triangleSize, triangleY,
                            triangleX + triangleSize, triangleY,
                            "rgba(0, 0, 0, 0.7)"
                        );

                        ctx.setTextAlign("center");
                        ctx.drawText(
                            player.x + playerWidth / 2,
                            bubbleY + messageBubbleHeight / 2 + 4,
                            state.playerMessages[player.name].text.length > 25 ?
                                state.playerMessages[player.name].text.substring(0, 22) + "..." :
                                state.playerMessages[player.name].text,
                            "white",
                            12
                        );
                        ctx.setTextAlign("left");
                    }
                }
            }
        });
    }

    if (state.smokeClouds && state.smokeClouds.length > 0) {
        state.smokeClouds.forEach(cloud => {
            ctx.drawCircle(cloud.x, cloud.y, SMOKE_RADIUS, "#888888");
        });
    }

    if (state.explosions && state.explosions.length > 0) {
        const rawCtx = ctx.rawCtx();
        state.explosions.forEach(explosion => {
            const posX = (explosion.x - ctx.cameraX) * ctx.zoom;
            const posY = (explosion.y - ctx.cameraY) * ctx.zoom;
            const radius = EXPLOSION_RADIUS * ctx.zoom;
            rawCtx.fillStyle = "orange";
            rawCtx.beginPath();
            rawCtx.arc(posX, posY, radius, 0, Math.PI * 2);
            rawCtx.fill();
            rawCtx.strokeStyle = "black";
            rawCtx.lineWidth = Math.max(1, 2 * ctx.zoom);
            rawCtx.stroke();
        });
    }

    return true;
}
