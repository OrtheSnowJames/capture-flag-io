// SPDX-License-Identifier: MIT
import { CANVAS_WIDTH, CANVAS_HEIGHT, lobbyPath, naem } from "../../../script.js";
import { state } from "../../state.js";
import { skins, redFlagImage, blueFlagImage } from "../../assets.js";
import { playerWidth, playerHeight, flagWidth, flagHeight } from "../../constants.js";

export function drawWorld(scene, ctx) {
    if (!state.initialized || !scene.mapsLoaded) return false;

    const cameraTargetName = state.dead ? state.spectatorTargetName : naem;
    const cameraTarget = cameraTargetName ? state.game.players[cameraTargetName] : null;
    if (!cameraTarget ||
        typeof cameraTarget.x === 'undefined' ||
        typeof cameraTarget.y === 'undefined') {
        return false;
    }

    ctx.setZoom(2.5);
    ctx.setCamera(cameraTarget.x - (CANVAS_WIDTH / 2) / 2.5, cameraTarget.y - (CANVAS_HEIGHT / 2) / 2.5);

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

    ctx.drawText(10, CANVAS_HEIGHT - 30, `Lobby: ${lobbyPath}, Map: ${state.currentMapData.name}`, "white", 16, false, false);

    if (state.game.flags) {
        Object.values(state.game.flags).forEach(flag => {
            if (flag && typeof flag.x !== 'undefined' && typeof flag.y !== 'undefined') {
                if (flag.capturedBy && state.game.players[flag.capturedBy]) {
                    const player = state.game.players[flag.capturedBy];
                    flag.x = player.x;
                    flag.y = player.y - flagHeight / 2;
                }

                ctx.drawImageScaled(flag.team === "red" ? redFlagImage : blueFlagImage, flag.x, flag.y, flagWidth, flagHeight);

                if (flag.capturedBy) {
                    const player = state.game.players[flag.capturedBy];
                    if (player && player.x && player.y) {
                        ctx.drawLine(flag.x + flagWidth / 2, flag.y + flagHeight / 9, player.x + playerWidth / 2, player.y + playerHeight / 2, "purple");
                    }
                }
            }
        });
    }

    if (state.game.players) {
        Object.values(state.game.players).forEach(player => {
            if (player &&
                typeof player.x !== 'undefined' &&
                typeof player.y !== 'undefined' &&
                player.color) {
                const playerColor = player.isOp ? "yellow" : player.color;
                if (!state.dead) {
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

                if (player.name) {
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

    return true;
}
