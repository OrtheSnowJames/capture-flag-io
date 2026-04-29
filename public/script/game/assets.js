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

let fadeRequestId = null;
let musicTracks = [];
let musicCycleIndex = -1;
let tracksLoaded = false;

function applyTrackForAllMaps(trackPath) {
    Object.values(audio.maps).forEach(map => {
        if (!map.bgm) return;
        map.bgm.pause();
        map.bgm.currentTime = 0;
        map.bgm.src = trackPath;
        map.bgm.loop = true;
        map.bgm.load();
    });
}

export async function loadMusicTracks() {
    if (tracksLoaded) return musicTracks;
    try {
        const response = await fetch('/api/music-tracks');
        const data = await response.json();
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
            musicTracks = data.tracks;
        }
    } catch (error) {
        console.error("Failed to load music tracks:", error);
    }

    if (musicTracks.length === 0) {
        musicTracks = ["/assets/music/evansong1.wav"];
    }

    tracksLoaded = true;
    return musicTracks;
}

export function getMusicCycleState() {
    if (musicCycleIndex < 0) {
        return { muted: true, label: "Muted" };
    }
    const trackName = musicTracks[musicCycleIndex]?.split('/').pop() || `Track ${musicCycleIndex + 1}`;
    return { muted: false, label: trackName };
}

export function setMusicMutedByDefault() {
    musicCycleIndex = -1;
    muteBGM(true);
}

export function cycleBGMTrack() {
    if (musicTracks.length === 0) {
        musicTracks = ["/assets/music/evansong1.wav"];
    }

    musicCycleIndex += 1;
    if (musicCycleIndex >= musicTracks.length) {
        musicCycleIndex = -1;
        muteBGM(true);
        return getMusicCycleState();
    }

    applyTrackForAllMaps(musicTracks[musicCycleIndex]);
    muteBGM(false);
    startBGM();
    return getMusicCycleState();
}

export function startBGM() {
    const currentMap = state.game.currentMap;
    if (audio.maps[currentMap] && audio.maps[currentMap].bgm) {
        audio.maps[currentMap].bgm.loop = true;
        if (typeof audio.maps[currentMap].bgm.volume !== "number") {
            audio.maps[currentMap].bgm.volume = 1;
        }
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

export function fadeBGMTo(targetVolume, durationMs = 700) {
    if (fadeRequestId) {
        cancelAnimationFrame(fadeRequestId);
        fadeRequestId = null;
    }

    const firstMap = Object.values(audio.maps).find(map => map.bgm);
    const startVolume = firstMap && typeof firstMap.bgm.volume === "number" ? firstMap.bgm.volume : 1;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const startTime = performance.now();

    const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, durationMs > 0 ? elapsed / durationMs : 1);
        const volume = startVolume + (clampedTarget - startVolume) * t;
        Object.values(audio.maps).forEach(map => {
            if (map.bgm) {
                map.bgm.volume = volume;
            }
        });
        if (t < 1) {
            fadeRequestId = requestAnimationFrame(step);
        } else {
            fadeRequestId = null;
        }
    };

    fadeRequestId = requestAnimationFrame(step);
}
