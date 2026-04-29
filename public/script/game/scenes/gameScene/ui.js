// SPDX-License-Identifier: MIT
import { OCtxButton, OCtxTextField } from "../../../context-engine.mjs";
import { CANVAS_WIDTH, CANVAS_HEIGHT, naem } from "../../../script.js";
import { state } from "../../state.js";
import { GamePhase, isIntermissionPhase } from "../../enums.js";
import { readableMessages, messageBoxHeight, dashCooldown } from "../../constants.js";
import { cycleBGMTrack, getMusicCycleState } from "../../assets.js";

const HUD_THEME = {
    panelBg: "rgba(8, 14, 24, 0.78)",
    panelBorder: "rgba(109, 168, 255, 0.7)",
    panelInner: "rgba(255, 255, 255, 0.06)",
    textPrimary: "#F4F8FF",
    textMuted: "#BDD2F7",
    accent: "#4DA3FF",
    danger: "#FF6B6B",
    success: "#8DE08A",
    button: {
        bg: "#122236",
        hover: "#193353",
        pressed: "#0F1C2D",
        border: "#73B2FF",
        text: "#EEF6FF"
    },
    buttonDanger: {
        bg: "#3A1C22",
        hover: "#512731",
        pressed: "#2C1419",
        border: "#FF8EA1",
        text: "#FFF0F3"
    },
    buttonAccent: {
        bg: "#193446",
        hover: "#24506A",
        pressed: "#163345",
        border: "#7AD1FF",
        text: "#F2FBFF"
    }
};

export function setupBaseUI(scene) {
    const messageBoxWidth = CANVAS_WIDTH * scene.messageBoxWidthRatio;
    const messageBoxHeight = CANVAS_HEIGHT * scene.messageBoxHeightRatio;
    const messageFieldHeight = CANVAS_HEIGHT * scene.messageFieldHeightRatio;
    const buttonWidth = CANVAS_WIDTH * scene.buttonWidthRatio;
    const buttonHeight = CANVAS_HEIGHT * scene.buttonHeightRatio;

    scene.messageField = new OCtxTextField(
        0,
        messageBoxHeight,
        messageBoxWidth,
        messageFieldHeight,
        Math.round(messageBoxWidth / 23)
    );

    scene.submitButton = new OCtxButton(
        messageBoxWidth + CANVAS_WIDTH * 0.0125,
        messageBoxHeight,
        buttonWidth,
        buttonHeight,
        "Send"
    );

    scene.musicButton = new OCtxButton(
        CANVAS_WIDTH * 0.03125,
        messageBoxHeight + CANVAS_HEIGHT * 0.175,
        buttonWidth,
        buttonHeight,
        "Switch Track"
    );

    scene.backButton = new OCtxButton(
        CANVAS_WIDTH * 0.03125,
        messageBoxHeight + CANVAS_HEIGHT * 0.0875,
        buttonWidth,
        buttonHeight,
        "Back"
    );

    scene.messageField.setPlaceholder("Type a message");
    scene.messageField.setColors("#0D1B2A", "#6AAAF8", "#EAF4FF");
    scene.messageField.setPlaceholderColor("#88A8D6");
    scene.messageField.setFontSize(Math.max(14, CANVAS_HEIGHT * 0.021));

    scene.submitButton.setColors(
        HUD_THEME.buttonAccent.bg,
        HUD_THEME.buttonAccent.hover,
        HUD_THEME.buttonAccent.pressed,
        HUD_THEME.buttonAccent.border,
        HUD_THEME.buttonAccent.text
    );
    scene.submitButton.fontSize = Math.max(14, CANVAS_HEIGHT * 0.024);
    scene.submitButton.cornerRadius = 10;

    scene.musicButton.setColors(
        HUD_THEME.button.bg,
        HUD_THEME.button.hover,
        HUD_THEME.button.pressed,
        HUD_THEME.button.border,
        HUD_THEME.button.text
    );
    scene.musicButton.fontSize = Math.max(13, CANVAS_HEIGHT * 0.021);
    scene.musicButton.cornerRadius = 10;

    scene.backButton.setColors(
        HUD_THEME.buttonDanger.bg,
        HUD_THEME.buttonDanger.hover,
        HUD_THEME.buttonDanger.pressed,
        HUD_THEME.buttonDanger.border,
        HUD_THEME.buttonDanger.text
    );
    scene.backButton.fontSize = Math.max(13, CANVAS_HEIGHT * 0.021);
    scene.backButton.cornerRadius = 10;
}

export function setupMapButtons(scene) {
    scene.mapButtons = [];
    const buttonWidth = CANVAS_WIDTH * 0.15625;
    const buttonHeight = CANVAS_HEIGHT * 0.075;
    const howManyButtons = 3;
    for (let i = 0; i < howManyButtons; i++) {
        const button = new OCtxButton(
            CANVAS_WIDTH * ((i + 1) * 0.25) - buttonWidth / 2,
            CANVAS_HEIGHT * 0.4,
            buttonWidth,
            buttonHeight,
            `Map ${i + 1}`
        );
        button.deactivate();
        button.setColors(
            HUD_THEME.button.bg,
            HUD_THEME.button.hover,
            HUD_THEME.button.pressed,
            HUD_THEME.button.border,
            HUD_THEME.button.text
        );
        button.cornerRadius = 12;
        button.fontSize = Math.max(14, CANVAS_HEIGHT * 0.022);
        scene.mapButtons.push(button);
    }
}

export function setupMobileButtons(scene) {
    if (!scene.isMobile) {
        console.log("Not creating mobile buttons - isMobile is:", scene.isMobile);
        return;
    }

    console.log("Creating mobile buttons - isMobile is:", scene.isMobile);
    const mobileButtonSize = Math.min(CANVAS_WIDTH * 0.12, CANVAS_HEIGHT * 0.16);
    const mobileButtonSpacing = mobileButtonSize * 1.3;
    const rightMargin = CANVAS_WIDTH * 0.02;
    const bottomMargin = CANVAS_HEIGHT * 0.05;

    const centerX = CANVAS_WIDTH - rightMargin - mobileButtonSize - mobileButtonSpacing;
    const centerY = CANVAS_HEIGHT - bottomMargin - mobileButtonSize - mobileButtonSpacing;

    console.log("Mobile button positions - centerX:", centerX, "centerY:", centerY, "size:", mobileButtonSize);

    scene.mobileButtons.up = new OCtxButton(
        centerX,
        centerY - mobileButtonSpacing,
        mobileButtonSize,
        mobileButtonSize,
        "↑"
    );

    scene.mobileButtons.down = new OCtxButton(
        centerX,
        centerY + mobileButtonSpacing,
        mobileButtonSize,
        mobileButtonSize,
        "↓"
    );

    scene.mobileButtons.left = new OCtxButton(
        centerX - mobileButtonSpacing,
        centerY,
        mobileButtonSize,
        mobileButtonSize,
        "←"
    );

    scene.mobileButtons.right = new OCtxButton(
        centerX + mobileButtonSpacing,
        centerY,
        mobileButtonSize,
        mobileButtonSize,
        "→"
    );

    scene.mobileButtons.dash = new OCtxButton(
        rightMargin + mobileButtonSize,
        centerY,
        mobileButtonSize,
        mobileButtonSize,
        "⚡"
    );

    console.log("Created mobile buttons:", scene.mobileButtons);

    Object.values(scene.mobileButtons).forEach(button => {
        if (button) {
            button.setColors(
                'rgba(255, 255, 255, 0.8)',
                'rgba(255, 255, 255, 0.95)',
                'rgba(200, 200, 200, 0.95)',
                '#333333',
                '#000000'
            );
            button.fontSize = mobileButtonSize * 0.5;
        }
    });

    if (scene.mobileButtons.dash) {
        scene.mobileButtons.dash.setColors(
            'rgba(255, 215, 0, 0.8)',
            'rgba(255, 215, 0, 0.95)',
            'rgba(255, 165, 0, 0.95)',
            '#333333',
            '#000000'
        );
    }
}

export function updateUI(scene, commands, deltaTime) {
    scene.messageField.update(commands, deltaTime);
    scene.submitButton.update(commands);
    scene.backButton.update(commands);
    scene.musicButton.update(commands);

    if (scene.musicButton.isClicked(commands)) {
        const musicState = cycleBGMTrack();
        state.newMusicPlay = !musicState.muted;
    }

    if (scene.backButton.isClicked(commands)) {
        scene.resetGame();
        window.location.href = "/";
    }

    if (scene.submitButton.isClicked(commands) || (commands.keys['Enter'] && scene.messageField.isActive)) {
        if (state.client && scene.messageField.text.trim() !== "") {
            scene.messageField.deactivate();
            state.client.emit('message', `${naem} said ${scene.messageField.text.trim()}`);
            scene.messageField.text = "";
        }
    }

    if (commands.keys['Enter'] && !scene.messageField.isActive) {
        scene.messageField.activate();
    }

    if (commands.keys['Escape'] && scene.messageField.isActive) {
        scene.messageField.deactivate();
    }

    if (state.bottomAnnouncement.active) {
        state.bottomAnnouncement.timer.setSeconds(state.bottomAnnouncement.timer.seconds() - deltaTime);
        if (state.bottomAnnouncement.timer.seconds() <= 0) {
            state.bottomAnnouncement.active = false;
        }
    }

    if (state.bottomAnnouncement.timer.seconds() <= 0) {
        state.bottomAnnouncement.active = false;
    }

    scene.mapButtons.forEach((button, index) => {
        button.update(commands);

        if (button.isClicked(commands) && index < state.mapSelection.length) {
            const selectedMap = state.mapSelection[index];
            state.votedFor = selectedMap;

            for (const map in state.mapVotes) {
                if (state.mapVotes[map]) {
                    state.mapVotes[map] = state.mapVotes[map].filter(player => player !== naem);
                }
            }

            if (!state.mapVotes[selectedMap]) {
                state.mapVotes[selectedMap] = [];
            }

            if (!state.mapVotes[selectedMap].includes(naem)) {
                state.mapVotes[selectedMap].push(naem);
            }

            if (state.client) {
                state.client.emit('playerVotedFor', JSON.stringify({ player: naem, map: selectedMap }));
            }
        }
    });

    if (scene.isMobile) {
        Object.values(scene.mobileButtons).forEach(button => {
            if (button) button.update(commands);
        });

        scene.mobileButtonStates.up = scene.mobileButtons.up && (scene.mobileButtons.up.isPressed || scene.mobileButtons.up.isClicked(commands));
        scene.mobileButtonStates.down = scene.mobileButtons.down && (scene.mobileButtons.down.isPressed || scene.mobileButtons.down.isClicked(commands));
        scene.mobileButtonStates.left = scene.mobileButtons.left && (scene.mobileButtons.left.isPressed || scene.mobileButtons.left.isClicked(commands));
        scene.mobileButtonStates.right = scene.mobileButtons.right && (scene.mobileButtons.right.isPressed || scene.mobileButtons.right.isClicked(commands));
        scene.mobileButtonStates.dash = scene.mobileButtons.dash && (scene.mobileButtons.dash.isPressed || scene.mobileButtons.dash.isClicked(commands));
    }
}

export function drawHUD(scene, ctx) {

    const messageBoxWidth = CANVAS_WIDTH * scene.messageBoxWidthRatio;
    const messageBoxHeight = CANVAS_HEIGHT * scene.messageBoxHeightRatio;
    ctx.drawRoundedRectFill(
        0,
        0,
        messageBoxWidth,
        messageBoxHeight,
        12,
        HUD_THEME.panelBg,
        false,
        false
    );
    ctx.drawRoundedRectFill(
        6,
        6,
        messageBoxWidth - 12,
        messageBoxHeight - 12,
        10,
        HUD_THEME.panelInner,
        false,
        false
    );
    const raw = ctx.rawCtx();
    raw.save();
    raw.strokeStyle = HUD_THEME.panelBorder;
    raw.lineWidth = 2;
    raw.strokeRect(1, 1, messageBoxWidth - 2, messageBoxHeight - 2);
    raw.restore();

    const displayMessages = [...state.game.messages].slice(-readableMessages);
    const messageFontSize = CANVAS_HEIGHT * scene.messageFontSizeRatio;
    for (let i = 0; i < displayMessages.length; i++) {
        const message = displayMessages[i];
        const messageY = (i + 1) * (messageBoxHeight / readableMessages) - 10;
        ctx.drawText(8, messageY, message, HUD_THEME.textPrimary, messageFontSize, false, false);
    }

    scene.messageField.draw(ctx, false, false);
    scene.submitButton.draw(ctx, false, false);
    scene.backButton.draw(ctx, false, false);
    scene.musicButton.draw(ctx, false, false);

    const musicState = getMusicCycleState();
    ctx.drawText(
        scene.musicButton.bounds.x + 6,
        scene.musicButton.bounds.y + scene.musicButton.bounds.height - 7,
        `Track: ${musicState.label}`,
        HUD_THEME.textMuted,
        messageFontSize * 0.75,
        false,
        false
    );

    if (scene.isMobile && !isIntermissionPhase(state.phase)) {
        Object.values(scene.mobileButtons).forEach(button => {
            if (button) button.draw(ctx, false, false);
        });

        if (state.dashCooldownRemaining > 0 && scene.mobileButtons.dash) {
            const cooldownPercent = state.dashCooldownRemaining / dashCooldown;
            const indicatorWidth = scene.mobileButtons.dash.bounds.width * cooldownPercent;
            ctx.drawRect(
                scene.mobileButtons.dash.bounds.x,
                scene.mobileButtons.dash.bounds.y + scene.mobileButtons.dash.bounds.height - 4,
                indicatorWidth,
                4,
                HUD_THEME.danger,
                false,
                false
            );
        }
    }

    if (!isIntermissionPhase(state.phase)) {
        const timerBoxWidth = CANVAS_WIDTH * scene.timerBoxWidthRatio;
        const timerBoxHeight = CANVAS_HEIGHT * scene.timerBoxHeightRatio;
        const timerFontSize = CANVAS_HEIGHT * scene.timerFontSizeRatio;

        ctx.drawRoundedRectFill(
            CANVAS_WIDTH / 2 - timerBoxWidth / 2,
            CANVAS_HEIGHT * 0.0125,
            timerBoxWidth,
            timerBoxHeight,
            10,
            "rgba(7, 20, 34, 0.88)",
            false,
            false
        );
        ctx.setTextAlign("center");

        if (state.phase === GamePhase.OVERTIME) {
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                "OVERTIME",
                HUD_THEME.danger,
                timerFontSize,
                false,
                false
            );
        } else {
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                scene.timestamp.string(),
                HUD_THEME.textPrimary,
                timerFontSize,
                false,
                false
            );
        }
        ctx.setTextAlign("left");
    } else if (state.game.players[naem]) {
        const winnerBoxWidth = ctx.rawCtx().measureText(`${state.winners.player} (${state.winners.team})`).width + CANVAS_WIDTH * 0.0125;
        const winnerBoxHeight = CANVAS_HEIGHT * 0.0625;
        const winnerFontSize = CANVAS_HEIGHT * scene.timerFontSizeRatio;

        ctx.drawRect(
            0,
            0,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            "rgba(0, 0, 0, 0.5)",
            false,
            false
        );

        ctx.drawRoundedRectFill(
            CANVAS_WIDTH / 2 - winnerBoxWidth / 2,
            CANVAS_HEIGHT * 0.0125,
            winnerBoxWidth,
            winnerBoxHeight,
            10,
            "rgba(7, 20, 34, 0.92)",
            false,
            false
        );

        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.0125 + winnerBoxHeight / 2,
            `${state.winners.player} (${state.winners.team})`,
            HUD_THEME.textPrimary,
            winnerFontSize,
            false,
            false
        );

        ctx.setTextAlign("left");

        if (state.winners.team === state.game.players[naem].team) {
            const voteFontSize = CANVAS_HEIGHT * scene.voteFontSizeRatio;
            const voteTimerFontSize = CANVAS_HEIGHT * scene.voteTimerFontSizeRatio;

            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.5,
                "Select a map",
                HUD_THEME.textPrimary,
                voteFontSize,
                false,
                false
            );

            scene.mapButtons.forEach((button, index) => {
                if (index < state.mapSelection.length) {
                    button.label = state.mapSelection[index] || `Map ${index + 1}`;
                    button.draw(ctx, false, false);
                }
            });

            let voteYPosition = CANVAS_HEIGHT * 0.5 + CANVAS_HEIGHT * 0.0625;

            for (let i = 0; i < state.mapSelection.length; i++) {
                const voteCount = state.mapVotes[state.mapSelection[i]] ? state.mapVotes[state.mapSelection[i]].length : 0;
                ctx.drawText(
                    CANVAS_WIDTH / 2,
                    voteYPosition,
                    `${state.mapSelection[i]}: ${voteCount} votes`,
                    HUD_THEME.textMuted,
                    voteFontSize,
                    false,
                    false
                );
                voteYPosition += CANVAS_HEIGHT * 0.025;
            }

            if (state.phase === GamePhase.VOTING) {
                const timeLeft = Math.ceil(state.votingTimer);
                const timerText = `Next map in: ${timeLeft} seconds`;
                ctx.drawText(
                    CANVAS_WIDTH / 2,
                    CANVAS_HEIGHT * 0.3,
                    timerText,
                    timeLeft <= 3 ? HUD_THEME.danger : HUD_THEME.textPrimary,
                    voteTimerFontSize,
                    false,
                    false
                );
            }
        } else {
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.5,
                "Waiting for next game...",
                "white",
                CANVAS_HEIGHT * scene.voteFontSizeRatio,
                false,
                false
            );
        }
    }

    if (scene.announcementActive) {
        ctx.drawRect(
            0,
            0,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            "rgba(0, 0, 0, 0.7)",
            false,
            false
        );

        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2,
            scene.announcementText,
            "white",
            CANVAS_HEIGHT * scene.announcementFontSizeRatio,
            false,
            false
        );
        ctx.setTextAlign("left");
    }

    if (state.bottomAnnouncement.active) {
        ctx.drawRect(
            0,
            CANVAS_HEIGHT - (CANVAS_HEIGHT / 4),
            CANVAS_WIDTH,
            CANVAS_HEIGHT / 4,
            "rgba(0, 0, 0, 0.7)",
            false,
            false
        );
        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT - (CANVAS_HEIGHT / 5) + CANVAS_HEIGHT * 0.05,
            state.bottomAnnouncement.header,
            "yellow",
            CANVAS_HEIGHT * (scene.announcementFontSizeRatio * 2),
            false,
            false
        );
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT - (CANVAS_HEIGHT / 5) + CANVAS_HEIGHT * 0.1,
            state.bottomAnnouncement.body,
            "#ccad58",
            CANVAS_HEIGHT * scene.announcementFontSizeRatio,
            false,
            false
        );
        ctx.setTextAlign("left");
    }
}
