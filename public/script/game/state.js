// SPDX-License-Identifier: MIT
import { timeData } from "../globals.js";
import { fieldWidth, fieldHeight } from "./constants.js";

export let goToDead = true;

export const state = {
    initialized: false,
    client: null,
    newMusicPlay: null,
    intermission: false,
    winners: { player: "", team: "" },
    mapSelection: [],
    votedFor: "",
    mapVotes: {},
    maps: {},
    currentMapData: null,
    mapObjects: [],
    lastMovementUpdate: 0,
    playerMessages: {},
    votingTimer: 10,
    votingActive: false,
    isOvertime: false,
    dashCooldownRemaining: 0,
    dashActive: false,
    dashTimeRemaining: 0,
    spectatorTargetName: null,
    spectatorTargetIndex: 0,
    dead: false,
    game: {
        players: {},
        flags: {
            red: { x: 100, y: 250, color: "red", team: "red", capturedBy: "" },
            blue: { x: 899, y: 250, color: "blue", team: "blue", capturedBy: "" }
        },
        messages: [],
        currentMap: "map1"
    },
    bottomAnnouncement: {
        header: "Capture the flag",
        body: "Team Game",
        active: true,
        timer: new timeData(5)
    },
    getClient: false,
    sendName: false,
    field: {
        x: 0,
        y: 0,
        width: fieldWidth,
        height: fieldHeight,
        bg: null,
        outbg: null,
        bgIsImage: false,
        outbgIsImage: false
    }
};
