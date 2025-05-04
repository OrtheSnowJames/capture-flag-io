# Operator Command Guide

Operators have access to special commands that allow them to manage the game and players. All operator commands use the `!op` prefix.
Operator commands are executed in the message box, and won't appear as a message.
This document provides a comprehensive list of available operator commands.

## Getting Operator Status

Players can be granted operator status by a server administrator using the server console command:
```
op <lobby_number> "<player_name>"
```

Operators are visually identifiable by their yellow player color.

## Available Commands

### Player Management

| Command | Syntax | Description |
|---------|--------|-------------|
| Kick | `!op kick <playerName>` | Removes a player from the game |

### Game Management

| Command | Syntax | Description |
|---------|--------|-------------|
| Maintenance | `!op maintenance` | Toggles maintenance mode (prevents new players from joining) |
| Map | `!op map <mapName>` | Changes the current map to the specified map |
| Highscore | `!op highscore` | Displays the current high score in the chat |

### Player Appearance

| Command | Syntax | Description |
|---------|--------|-------------|
| Skin | `!op skin <playerName> <skinId>` | Changes a player's skin (0 = default, 1-3 = custom skins) |

### System Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| Clear | `!op clear` | Clears the server console |
| Exec | `!op exec <command>` | Executes a system command on the server |
| Announce | `!op announce <message>` | Displays an announcement to all players |

## Examples

### Kicking a Player
```
!op kick PlayerName
```
This command removes "PlayerName" from the game.

### Changing Maps
```
!op map map2
```
This command changes the current map to "map2".

### Setting a Player's Skin
```
!op skin PlayerName 2
```
This command sets "PlayerName"'s skin to skin #2.

### Making an Announcement
```
!op announce The server will restart in 5 minutes!
```
This shows a server-wide announcement with the message "The server will restart in 5 minutes!"

## Notes

- Operator commands are only available to players who have been granted operator status
- Commands are case-sensitive
- Players can see who has operator status by their yellow color
- Operators have extended chat message length limits (500 characters vs 100 for regular players, text will go outside the box length so be careful!)
