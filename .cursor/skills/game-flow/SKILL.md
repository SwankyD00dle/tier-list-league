---
name: game-flow
description: Reference the tier-list-league game flow and rules when implementing or modifying gameplay — registration and join flows, the round/turn lifecycle, scoring, and win conditions.
---

# Tier List League — Game Flow

This document describes how the game works end to end: pregame setup, in-game turns,
scoring, and win conditions. Use it as the source of truth for gameplay behavior when
building or changing features.

Notation: `X`, `Y`, and `Z` are admin-configured game settings — `X` = day timeout
period, `Y` = number of rounds, `Z` = points threshold (see Win condition).

## Pregame

### Join flow in app

- **Register** (for first-time users)
  - Pick a name and authorize the user with Discord OAuth.
- **Create a game** from the home screen.
- On the next screen, as the **admin** of the game:
  - Admin can set the game name.
  - Admin has a **Copy invite link** button.
  - Admin has a regular message portal up.
  - **Game settings** (cannot be changed after the game starts — these fields are in a disabled state once the game is started):
    - `X` day timeout period.
    - Set `Y` or `Z` for the win condition.
  - **Members list**
    - Players can be kicked here.

### Join flow from invite link

- Click the link from Discord.
- Pick a name and authorize the user with Discord OAuth.
- The user is created and added to the game.
- Taken to the lobby. (Current task: adding a picture for the last joined user.)

## Turns

Each round proceeds through the following steps:

1. **Host submits tier list.** All other players are in the pending state until their guesses are submitted.
2. **Users submit guesses.** Hidden until turn end; cut off `X` days from turn 1. Once all participants submit a guess, the host is now pending.
3. **Host picks the winner and honorable mentions.**
   - Winner: show the original input, the winning guess, and the host tier list.
   - Honorable mentions: show all guesses.
   - The person chosen in step 4 is now set to pending.
4. **Winner takes turn 1.** The winner — or a random player, if they have already won a round and someone has not hosted yet — takes turn 1.
   - **4a. (Async, for fun.)** Users can submit tier lists for what they think the tier list should look like. At `X` days, find a way to score these tier lists and make an average of everyone to show on the round.

## Scoring

### Win condition

- **`Y` Rounds** — End after everyone has hosted `Y` number of times.
- **`Z` Points** — End after someone has reached `X` number of points.

### Points

- Winner gets **3**.
- Honorable mentions get **1** (max group size / 5 - 1).
- The post with the most unique user reactions gets **1**?
- Comment on Discord a screenshot of:
  - Current game profile picture
  - Username
  - Host's original title
  - Their submitted tier list from turn 4a
