# Server Console Commands

This document lists all available commands that can be used in the node server console. These commands allow server administrators to manage lobbies, players, and game state. These commands can be typed in at any time through stdin and executed with enter.

## Player Management Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| op | `op <lobby_number> "<player_name>"` | Grants operator status to a player |
| kick | `kick <lobby_number> "<player_name>"` | Removes a player from a specific lobby |

## Lobby Management Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| maintenance | `maintenance <lobby_number|all> <true|false>` | Toggles maintenance mode for a lobby or all lobbies |
| game | `game <lobby_number>` | Displays the current game state for a specific lobby |
| skip_round | `skip_round <lobby_number>` | Ends the current round and starts the voting phase |

## Server Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| exit | `exit` | Gracefully shuts down the server |
| clear | `clear` | Clears the server console |
| feedback | `feedback` | Displays all player feedback from the feedback.txt file |

## Examples

### Making a Player an Operator
```
op 1 "PlayerName"
```
This command grants operator status to "PlayerName" in lobby 1.

### Kicking a Player
```
kick 1 "PlayerName"
```
This command removes "PlayerName" from lobby 1.

### Enabling Maintenance Mode
```
maintenance 1 true
```
This command enables maintenance mode for lobby 1, preventing new players from joining.

### Viewing Game State
```
game 1
```
This command displays the current game state for lobby 1, including players, scores, and flags.

### Ending Current Round
```
skip_round 1
```
This command ends the current round in lobby 1 and initiates the map voting phase.

### Viewing Feedback
```
feedback
```
This command displays all player feedback that has been submitted.

## Notes

- Player names with spaces must be enclosed in quotation marks
- Lobby numbers start at 1
- Commands are case-sensitive
- Server responds with success/failure messages after command execution
