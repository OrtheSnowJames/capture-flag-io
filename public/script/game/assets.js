// SPDX-License-Identifier: MIT
import { playerWidth, playerHeight, flagWidth, flagHeight } from "./constants.js";
import { state } from "./state.js";

export const skins = [
    null,
    new Image(playerWidth, playerHeight),
    new Image(playerWidth, playerHeight),
    new Image(playerWidth, playerHeight)
];

skins[1].src = "/assets/skins/skin1.png";
skins[2].src = "/assets/skins/skin2.png";
skins[3].src = "/assets/skins/skin3.png";

export const redFlagImage = new Image(flagWidth, flagHeight);
redFlagImage.src = "/assets/redflag.png";
export const blueFlagImage = new Image(flagWidth, flagHeight);
blueFlagImage.src = "/assets/blueflag.png";

export const audio = {
    maps: {
        "map1": {
            "bgm": new Audio("/assets/music/evansong1.wav")
        },
        "map2": {
            "bgm": new Audio("/assets/music/evansong1.wav")
        }
    }
};

export function startBGM() {
    const currentMap = state.game.currentMap;
    if (audio.maps[currentMap] && audio.maps[currentMap].bgm) {
        audio.maps[currentMap].bgm.loop = true;
        audio.maps[currentMap].bgm.play().catch(e => console.log("BGM play failed:", e));
    }
}

export function muteBGM(mute) {
    Object.values(audio.maps).forEach(map => {
        if (map.bgm) {
            map.bgm.muted = mute;
        }
    });
}
