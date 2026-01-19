// SPDX-License-Identifier: MIT
import { OCtxButton, OCtxTextField } from "../../../context-engine.mjs";
import { CANVAS_WIDTH, CANVAS_HEIGHT, naem } from "../../../script.js";
import { state } from "../../state.js";
import { readableMessages, messageBoxHeight, dashCooldown } from "../../constants.js";
import { muteBGM } from "../../assets.js";

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
        "Music Mute"
    );

    scene.backButton = new OCtxButton(
        CANVAS_WIDTH * 0.03125,
        messageBoxHeight + CANVAS_HEIGHT * 0.0875,
        buttonWidth,
        buttonHeight,
        "Back"
    );

    scene.messageField.setPlaceholder("Type a message");
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
        state.newMusicPlay = !state.newMusicPlay;
        muteBGM(!state.newMusicPlay);
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
    if (state.dead) {
        return;
    }

    const messageBoxWidth = CANVAS_WIDTH * scene.messageBoxWidthRatio;
    const messageBoxHeight = CANVAS_HEIGHT * scene.messageBoxHeightRatio;
    ctx.drawRect(
        0,
        0,
        messageBoxWidth,
        messageBoxHeight,
        "rgba(255, 255, 255, 0.5)",
        false,
        false
    );

    const displayMessages = [...state.game.messages].slice(-readableMessages);
    const messageFontSize = CANVAS_HEIGHT * scene.messageFontSizeRatio;
    for (let i = 0; i < displayMessages.length; i++) {
        const message = displayMessages[i];
        const messageY = (i + 1) * (messageBoxHeight / readableMessages) - 10;
        ctx.drawText(5, messageY, message, "white", messageFontSize, false, false);
    }

    scene.messageField.draw(ctx, false, false);
    scene.submitButton.draw(ctx, false, false);
    scene.backButton.draw(ctx, false, false);
    scene.musicButton.draw(ctx, false, false);

    ctx.drawText(
        scene.musicButton.bounds.x + scene.musicButton.bounds.width / 5,
        scene.musicButton.bounds.y + scene.musicButton.bounds.height - 7,
        state.newMusicPlay ? "✓" : "✗",
        "black",
        messageFontSize,
        false,
        false
    );

    if (scene.isMobile && !state.intermission) {
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
                "red",
                false,
                false
            );
        }
    }

    if (!state.intermission) {
        const timerBoxWidth = CANVAS_WIDTH * scene.timerBoxWidthRatio;
        const timerBoxHeight = CANVAS_HEIGHT * scene.timerBoxHeightRatio;
        const timerFontSize = CANVAS_HEIGHT * scene.timerFontSizeRatio;

        ctx.drawRect(
            CANVAS_WIDTH / 2 - timerBoxWidth / 2,
            CANVAS_HEIGHT * 0.0125,
            timerBoxWidth,
            timerBoxHeight,
            "black",
            false,
            false
        );
        ctx.setTextAlign("center");

        if (state.isOvertime) {
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                "OVERTIME",
                "red",
                timerFontSize,
                false,
                false
            );
        } else {
            ctx.drawText(
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT * 0.0125 + timerBoxHeight / 2,
                scene.timestamp.string(),
                "white",
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

        ctx.drawRect(
            CANVAS_WIDTH / 2 - winnerBoxWidth / 2,
            CANVAS_HEIGHT * 0.0125,
            winnerBoxWidth,
            winnerBoxHeight,
            "black",
            false,
            false
        );

        ctx.setTextAlign("center");
        ctx.drawText(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT * 0.0125 + winnerBoxHeight / 2,
            `${state.winners.player} (${state.winners.team})`,
            "white",
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
                "white",
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
                    "white",
                    voteFontSize,
                    false,
                    false
                );
                voteYPosition += CANVAS_HEIGHT * 0.025;
            }

            if (state.votingActive) {
                const timeLeft = Math.ceil(state.votingTimer);
                const timerText = `Next map in: ${timeLeft} seconds`;
                ctx.drawText(
                    CANVAS_WIDTH / 2,
                    CANVAS_HEIGHT * 0.3,
                    timerText,
                    timeLeft <= 3 ? "red" : "white",
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
