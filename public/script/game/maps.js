// SPDX-License-Identifier: MIT
import { state } from "./state.js";
import { fieldWidth, fieldHeight, playerWidth, playerHeight } from "./constants.js";

export async function loadMaps() {
    try {
        const response = await fetch('/assets/maps.json');
        state.maps = await response.json();
        console.log("Maps loaded:", state.maps);
        return true;
    } catch (error) {
        console.error("Error loading maps:", error);
        return false;
    }
}

export function getMapByName(mapName) {
    for (const key of Object.keys(state.maps)) {
        if (state.maps[key].name === mapName) {
            return state.maps[key];
        }
    }
    return null;
}

export function parseMap(mapName) {
    if (!getMapByName(mapName) && !state.maps[mapName]) {
        console.error(`Map ${mapName} not found`);
        return false;
    }

    const map = getMapByName(mapName) === null ? state.maps[mapName] : getMapByName(mapName);
    state.currentMapData = map;

    const isImagePath = (path) => {
        if (!path || typeof path !== 'string') return false;
        return path.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null || path.startsWith('img(');
    };

    const getImagePath = (path) => {
        if (!path || typeof path !== 'string') return '';
        if (path.startsWith('img(')) {
            return path.slice(4, -1).replace(/['"]/g, '');
        }
        return path;
    };

    if (isImagePath(map.bg)) {
        state.field.bg = new Image();
        state.field.bg.src = getImagePath(map.bg);
        state.field.bgIsImage = true;
    } else {
        state.field.bg = map.bg || "#4f4d4a";
        state.field.bgIsImage = false;
    }

    if (isImagePath(map.outbg)) {
        state.field.outbg = new Image();
        state.field.outbg.src = getImagePath(map.outbg);
        state.field.outbgIsImage = true;
    } else {
        state.field.outbg = map.outbg || "#918777";
        state.field.outbgIsImage = false;
    }

    state.mapObjects.length = 0;

    if (map.objects && Array.isArray(map.objects)) {
        map.objects.forEach(obj => {
            try {
                const evalInContext = (expr, context) => {
                    const paramNames = Object.keys(context);
                    const paramValues = Object.values(context);
                    const evaluator = new Function(...paramNames, `return ${expr};`);
                    return evaluator(...paramValues);
                };

                let imgObject = null;
                const isTypeImage = typeof obj.type === 'string' && obj.type.startsWith('img(');
                const isColorImage = isImagePath(obj.color);

                if (isTypeImage || isColorImage) {
                    imgObject = new Image();
                    if (isTypeImage) {
                        imgObject.src = getImagePath(obj.type);
                    } else if (isColorImage) {
                        imgObject.src = getImagePath(obj.color);
                    }

                    if (!imgObject.complete) {
                        imgObject.width = 100;
                        imgObject.height = 100;

                        imgObject.onload = function() {
                            const objIndex = state.mapObjects.findIndex(o =>
                                o.imageSrc === imgObject.src ||
                                (o.color === imgObject && o.isImageColor)
                            );

                            if (objIndex !== -1) {
                                if (typeof obj.width === 'undefined') {
                                    state.mapObjects[objIndex].width = imgObject.naturalWidth;
                                }
                                if (typeof obj.height === 'undefined') {
                                    state.mapObjects[objIndex].height = imgObject.naturalHeight;
                                }
                            }
                        };
                    }
                }

                const evalContext = {
                    canvasWidth: fieldWidth,
                    canvasHeight: fieldHeight,
                    playerWidth: playerWidth,
                    playerHeight: playerHeight,
                    img: imgObject
                };

                const x = typeof obj.x === 'string' ?
                    evalInContext(obj.x, evalContext) : obj.x;
                const y = typeof obj.y === 'string' ?
                    evalInContext(obj.y, evalContext) : obj.y;

                let width;
                let height;

                if (typeof obj.width === 'string') {
                    width = evalInContext(obj.width, evalContext);
                } else if (obj.width !== undefined) {
                    width = obj.width;
                } else if (imgObject) {
                    width = imgObject.naturalWidth || imgObject.width;
                }

                if (typeof obj.height === 'string') {
                    height = evalInContext(obj.height, evalContext);
                } else if (obj.height !== undefined) {
                    height = obj.height;
                } else if (imgObject) {
                    height = imgObject.naturalHeight || imgObject.height;
                }

                let color = obj.color;
                let isImageColor = false;

                if (isImagePath(obj.color)) {
                    color = imgObject || new Image();
                    if (!imgObject) {
                        color.src = getImagePath(obj.color);
                    }
                    isImageColor = true;
                }

                let isImage = false;
                let imageSrc = '';
                if (isTypeImage) {
                    isImage = true;
                    imageSrc = getImagePath(obj.type);
                    color = imgObject || new Image();
                    if (!imgObject) {
                        color.src = imageSrc;
                    }
                    isImageColor = true;
                }

                let rotation = 0;
                if (typeof obj.rotation === 'string') {
                    rotation = evalInContext(obj.rotation, evalContext);
                } else if (typeof obj.rotation === 'number') {
                    rotation = obj.rotation;
                }

                let collideType = null;
                if (obj.collide === 'inside') {
                    collideType = 'inside';
                } else if (obj.collide === 'outside' || obj.collide === true) {
                    collideType = 'outside';
                }

                state.mapObjects.push({
                    type: isImage ? 'image' : obj.type,
                    functionalType: obj.type,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    color: color,
                    isImageColor: isImageColor,
                    imageSrc: isImage ? imageSrc : (isImageColor ? getImagePath(obj.color) : null),
                    collideType: collideType,
                    rotation: rotation,
                    property: obj.property
                });
            } catch (e) {
                console.error("Error parsing map object:", e, obj);
            }
        });
    }

    console.log("Map parsed:", mapName, state.mapObjects);
    return true;
}
