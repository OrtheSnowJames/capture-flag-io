// SPDX-License-Identifier: MIT
import { Scene } from "../../context-engine.mjs";
import { naem, engine, lobbyPath, musicPlay } from "../../script.js";
import { state } from "../state.js";
import { GamePhase, PlayerLife } from "../enums.js";
import { loadMaps, parseMap } from "../maps.js";
import { startBGM, muteBGM } from "../assets.js";
import { isMobileDevice } from "../utils.js";
import { timeData } from "../../globals.js";
import { setupBaseUI, setupMapButtons, setupMobileButtons, drawHUD } from "./gameScene/ui.js";
import { setupNetworkListeners } from "./gameScene/network.js";
import { updateGameScene, tickSpectator } from "./gameScene/update.js";
import { drawWorld } from "./gameScene/renderWorld.js";
import { setupDeadOverlay, updateDeadOverlay, drawDeadOverlay } from "./gameScene/deadOverlay.js";

export class gameScene extends Scene {
    messageBoxWidthRatio = 0.3125;
    messageBoxHeightRatio = 0.2625;
    messageFieldHeightRatio = 0.075;
    buttonWidthRatio = 0.0875;
    buttonHeightRatio = 0.075;
    timerBoxWidthRatio = 0.09375;
    timerBoxHeightRatio = 0.0625;
    messageFontSizeRatio = 0.025;
    timerFontSizeRatio = 0.025;
    announcementFontSizeRatio = 0.0375;
    voteFontSizeRatio = 0.025;
    voteTimerFontSizeRatio = 0.03;
    deadButtonWidthRatio = 0.16;
    deadButtonHeightRatio = 0.075;
    deadArrowWidthRatio = 0.06;
    deadTitleFontSizeRatio = 0.04;

    messageField = null;
    submitButton = null;
    musicButton = null;
    backButton = null;
    announcementText = "";
    announcementTimer = 0;
    announcementActive = false;

    mapButtons = [];
    deadLeftButton = null;
    deadRightButton = null;
    deadRespawnButton = null;
    deadLeaveButton = null;

    constructor() {
        super();
        this.interpolationTime = 0;
        this.mapsLoaded = false;
        this.loadedMap = null;
        this.timestamp = new timeData(5 * 60);

        this.isMobile = isMobileDevice();
        this.mobileButtons = {
            up: null,
            down: null,
            left: null,
            right: null,
            dash: null
        };
        this.mobileButtonStates = {
            up: false,
            down: false,
            left: false,
            right: false,
            dash: false
        };

        this.init();
    }

    init() {
        setupBaseUI(this);
        setupMapButtons(this);
        setupMobileButtons(this);
        setupDeadOverlay(this);
    }

    setupListeners() {
        setupNetworkListeners(this);
    }

    async onLoad(commands) {
        this.commands = commands;
        state.newMusicPlay = musicPlay;
        if (!await loadMaps()) {
            commands.globals.reason = "Failed to load maps. Please try again.";
            commands.switchScene(0);
            return;
        }

        this.mapsLoaded = true;

        if (!parseMap("map1")) {
            commands.globals.reason = "Failed to parse default map. Please try again.";
            commands.switchScene(0);
            return;
        }

        this.loadedMap = "map1";

        try {
            state.client = await io(`${lobbyPath}`, { transports: ['websocket'], upgrade: false });

            await this.setupListeners();

            this.timestamp = new timeData(5 * 60);

            startBGM();
            muteBGM(!state.newMusicPlay);

            setTimeout(() => {
                state.client.emit('name', naem);
            }, 100);
        } catch (error) {
            commands.globals.reason = "Failed to connect to server. Please try again.";
            commands.switchScene(0);
        }
    }

    async onExit(commands) {
        state.initialized = false;
        state.sendName = false;
        state.getClient = false;
        state.life = PlayerLife.ALIVE;
        state.phase = GamePhase.GAME;
        muteBGM(true);
        state.game = {
            players: {},
            flags: {},
            messages: [],
            currentMap: "map1"
        };
        if (state.client) {
            state.client.disconnect();
        }
    }

    bottomAnnouncementSet(header, body) {
        state.bottomAnnouncement.header = header;
        state.bottomAnnouncement.body = body;
        state.bottomAnnouncement.active = true;
        state.bottomAnnouncement.timer.setSeconds(5);
    }

    resetGame() {
        muteBGM(true);
        state.game = {
            players: {},
            flags: {},
            messages: [],
            currentMap: "map1"
        };
        if (state.client) {
            state.client.disconnect();
        }
        this.timestamp = new timeData(5 * 60);
        state.phase = GamePhase.GAME;
        state.mapSelection = [];
        state.mapVotes = {};
        state.votedFor = null;
        state.dashActive = false;
        state.dashCooldownRemaining = 0;
        state.dashTimeRemaining = 0;
        state.playerMessages = {};
        state.lastMovementUpdate = 0;
        state.initialized = false;
        state.sendName = false;
        state.getClient = false;
        state.life = PlayerLife.ALIVE;

        engine.scenes[1] = new gameScene();
    }

    update(deltaTime, commands) {
        try {
            if (state.life === PlayerLife.DEAD) {
                tickSpectator(this, deltaTime);
                updateDeadOverlay(this, commands);
                return;
            }

            updateGameScene(this, deltaTime, commands);
        } catch (e) {
            console.error("Game error:", e);
            commands.globals.reason = "Client side error, may be death, for nerds: " + e.message + " " + e.stack;
            commands.switchScene(0);
        }
    }

    draw(ctx) {
        if (!drawWorld(this, ctx)) {
            return;
        }
        if (state.life === PlayerLife.DEAD) {
            drawDeadOverlay(this, ctx);
            return;
        }

        drawHUD(this, ctx);
    }

    requestMapChange(mapName) {
        if (state.client && mapName) {
            console.log(`Requesting map change to: ${mapName}`);
            state.client.emit('changeMap', JSON.stringify({ mapName: mapName }));
        }
    }
}
