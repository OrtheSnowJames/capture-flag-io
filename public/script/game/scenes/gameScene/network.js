// SPDX-License-Identifier: MIT
import { naem } from "../../../script.js";
import { state } from "../../state.js";
import { readableMessages } from "../../constants.js";
import { timeData } from "../../../globals.js";

export function setupNetworkListeners(scene) {
    state.client.on('move', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        const playerName = data.name;
        if (playerName === naem) {
            return;
        }

        const playerX = data.x;
        const playerY = data.y;

        if (state.game.players[playerName]) {
            state.game.players[playerName].prevX = state.game.players[playerName].x;
            state.game.players[playerName].prevY = state.game.players[playerName].y;
            state.game.players[playerName].targetX = playerX;
            state.game.players[playerName].targetY = playerY;
            state.game.players[playerName].interpolationTime = 0;
        } else {
            console.log(`Player ${playerName} not found in game object.`);
        }
    });

    state.client.on('message', (data) => {
        const message = data;
        if (typeof message !== 'string') return;
        if (message.startsWith("!op")) return;
        state.game.messages.push(message);
        if (state.game.messages.length > readableMessages) {
            state.game.messages.shift();
        }

        const match = message.match(/^(.+?) said (.+)$/);
        if (match && match.length === 3) {
            const playerName = match[1];
            const messageText = match[2];

            state.playerMessages[playerName] = {
                text: messageText,
                timestamp: performance.now()
            };
        }
    });

    state.client.on('newPlayer', (data) => {
        if (!state.initialized) {
            setTimeout(() => {
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                if (data.name === naem) return;
                data.prevX = data.x;
                data.prevY = data.y;
                data.targetX = data.x;
                data.targetY = data.y;
                data.interpolationTime = 0;
                state.game.players[data.name] = data;
            }, 100);
            return;
        }

        if (!data) return;
        if (data.name === naem) return;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        data.targetX = data.x;
        data.targetY = data.y;
        data.interpolationTime = 0;
        state.game.players[data.name] = data;
    });

    state.client.on('kill', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (state.game.players[data.player]) {
            delete state.game.players[data.player];
        }

        if (state.game.players[data.player]?.name === naem) {
            state.dead = true;
            state.spectatorTargetName = null;
            state.spectatorTargetIndex = 0;
            scene.messageField.setValue("");
            scene.messageField.deactivate();
            if (scene.commands) {
                scene.commands.switchScene(2);
            }
        }
    });

    state.client.on('flagCaptured', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.flag in state.game.flags) {
            state.game.flags[data.flag].capturedBy = data.player;
        }

        scene.bottomAnnouncementSet("Flag Captured!", `by ${data.player}`);
    });

    state.client.on('flagDropped', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.flag in state.game.flags) {
            state.game.flags[data.flag].capturedBy = "";
        }
    });

    state.client.on('flagMoved', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.flag in state.game.flags) {
            state.game.flags[data.flag].prevX = state.game.flags[data.flag].x;
            state.game.flags[data.flag].prevY = state.game.flags[data.flag].y;
            state.game.flags[data.flag].targetX = data.x;
            state.game.flags[data.flag].targetY = data.y;
            state.game.flags[data.flag].interpolationTime = 0;

            if (state.game.flags[data.flag].capturedBy) {
                state.game.flags[data.flag].x = data.x;
                state.game.flags[data.flag].y = data.y;
            }
        }
    });

    state.client.on('flagReturned', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.flag in state.game.flags) {
            state.game.flags[data.flag].capturedBy = "";

            if (data.flag === "red") {
                state.game.flags.red.x = 100;
                state.game.flags.red.y = 250;
                state.game.flags.red.prevX = 100;
                state.game.flags.red.prevY = 250;
                state.game.flags.red.targetX = 100;
                state.game.flags.red.targetY = 250;
                state.game.flags.red.interpolationTime = 1;
            } else {
                state.game.flags.blue.x = 900;
                state.game.flags.blue.y = 250;
                state.game.flags.blue.prevX = 900;
                state.game.flags.blue.prevY = 250;
                state.game.flags.blue.targetX = 900;
                state.game.flags.blue.targetY = 250;
                state.game.flags.blue.interpolationTime = 1;
            }
        }

        if (state.game.players[data.player]) {
            state.game.players[data.player].capture = false;
        }

        if (data.scoredBy) {
            scene.bottomAnnouncementSet("Team Scored!", `by ${data.scoredBy}, for ${state.game.players[data.scoredBy].team}`);
        } else {
            scene.bottomAnnouncementSet("Flag Returned.", `by ${data.player}`);
        }
    });

    state.client.on('scoreUp', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.player in state.game.players) {
            if (data.score !== undefined) {
                state.game.players[data.player].score = data.score;
            } else {
                state.game.players[data.player].score = (state.game.players[data.player].score || 0) + 1;
            }
        }

        scene.bottomAnnouncementSet("Score Updated!", `${data.player} now has ${data.score} points`);
    });

    state.client.on('gameState', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        Object.keys(data.players).forEach(playerName => {
            const player = data.players[playerName];
            player.prevX = player.x;
            player.prevY = player.y;
            player.targetX = player.x;
            player.targetY = player.y;
            player.interpolationTime = 0;
        });

        Object.keys(data.flags).forEach(flagName => {
            const flag = data.flags[flagName];
            flag.prevX = flag.x;
            flag.prevY = flag.y;
            flag.targetX = flag.x;
            flag.targetY = flag.y;
            flag.interpolationTime = 0;
        });

        if (data.currentMap) {
            state.game.currentMap = data.currentMap;
        } else {
            data.currentMap = state.game.currentMap;
        }

        state.game = data;
        state.initialized = true;
    });

    state.client.on('connect', () => {
        state.getClient = true;
    });

    state.client.on('playerVotedFor', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data.player === naem) {
            state.votedFor = data.map;
        } else {
            for (const map in state.mapVotes) {
                if (state.mapVotes[map]) {
                    state.mapVotes[map] = state.mapVotes[map].filter(player => player !== data.player);
                }
            }

            if (!state.mapVotes[data.map]) {
                state.mapVotes[data.map] = [];
            }

            if (!state.mapVotes[data.map].includes(data.player)) {
                state.mapVotes[data.map].push(data.player);
            }
        }
    });

    state.client.on('mapChange', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (data.currentMap) {
            state.game.currentMap = data.currentMap;
            console.log(`Map changed to: ${data.currentMap}`);

            state.intermission = false;
            state.votingActive = false;
            state.isOvertime = false;

            scene.timestamp = new timeData(5 * 60);

            state.mapSelection = [];
            state.mapVotes = {};
        }
    });

    state.client.on('timerUpdate', (timeString) => {
        if (state.initialized) {
            if (timeString === "OVERTIME") {
                state.isOvertime = true;
            } else {
                state.isOvertime = false;
                scene.timestamp.setFromString(timeString);
            }
        }
    });

    state.client.on('overtimeStarted', (message) => {
        state.isOvertime = true;

        if (state.game.messages) {
            state.game.messages.push("OVERTIME: " + message);
            if (state.game.messages.length > 10) {
                state.game.messages.shift();
            }
        }
    });

    state.client.on('gameOver', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        state.winners.player = data.winner;
        state.winners.team = data.teamwinner;
        state.intermission = true;
        state.isOvertime = false;

        scene.timestamp = new timeData(5 * 60);

        state.votingTimer = 10;
        state.votingActive = true;

        const maps = data.maps;
        if (!Array.isArray(maps) || maps.length === 0) return;

        const filteredMaps = maps.filter(map => map !== state.game.currentMap);

        if (filteredMaps.length > 0) {
            state.mapSelection = filteredMaps;

            state.mapSelection.forEach(map => {
                if (!state.mapVotes[map]) {
                    state.mapVotes[map] = [];
                }
            });

            scene.mapButtons.forEach((button, index) => {
                if (index < state.mapSelection.length) {
                    button.activate();
                    button.label = state.mapSelection[index];
                } else {
                    button.deactivate();
                }
            });
        }
    });

    state.client.on('flagsState', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        state.game.flags = data;
    });

    state.client.on('skinChange', (data) => {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        const playerName = data.player;
        const skinId = data.skin;

        if (state.game.players[playerName]) {
            state.game.players[playerName].skin = skinId;
        }
    });

    state.client.on('announce', (message) => {
        scene.announcementText = message;
        scene.announcementTimer = 7;
        scene.announcementActive = true;
    });
}
