// SPDX-License-Identifier: MIT

export const GamePhase = Object.freeze({
    GAME: "game",
    OVERTIME: "overtime",
    INTERMISSION: "intermission",
    VOTING: "voting"
});

export const PlayerLife = Object.freeze({
    ALIVE: "alive",
    DEAD: "dead"
});

export function isIntermissionPhase(phase) {
    return phase === GamePhase.INTERMISSION || phase === GamePhase.VOTING;
}

export function isPlayingPhase(phase) {
    return phase === GamePhase.GAME || phase === GamePhase.OVERTIME;
}
