# Next Session Findings

Do not start by broadening scope. These are user-reported issues to inspect and fix in the next implementation session.

## Solitaire

- Single-click auto move does not work on desktop.
- Auto-complete does not recognize cards in the deck.
- Add animations where missing.
- Preserve existing carry/drag behavior while fixing click-to-auto-move.
- Preserve/add undo behavior.
- Redesign Solitaire cards; current cards look bad.

## Water Sort

- Current bottle visuals are unacceptable and should be replaced with a significantly better design.
- Use whatever frontend stack/approach is needed, but remove the current garbage bottle look.
- Add pouring animation.

## Minesweeper

- Fix padding and fitting issues shown in images 3, 4, and 5.
- Image 3: no padding.
- Image 4: excess right padding.
- Image 5: squares do not fit.
- These are likely the same root problem: the board does not fit consistently into the screen.
- Find an extraordinary solution for this fitting problem, not a minor patch that only fixes one viewport.

## Block Blast

- Image 6 shows the dragged block squares are not the same size as the board highlight squares.
- This makes it hard to understand where the block will be placed.
- Make dragged pieces the same size as board squares while dragging.
- The lifted block is too far away from where the user clicked; some lift was intentional, but the current offset is too large.

## 15 Puzzle

- Keyboard play is not available or not working.

## Tic-Tac-Toe

- Improve the visual design of X and O.

## General

- Offline Manager cannot download 15 Puzzle.
- Images 7 and 8 show unreadable text in Dark Mode.
- Image 8 shows the Singleplayer/Multiplayer bubble is misaligned with the title in some game cards.
- Move the Settings screen "Back to Home" button to the top.
- Image 2 shows a visual bug that occurs in every difficulty menu.
- Redesign undo/redo controls:
  - Use one primary undo button.
  - Put redo behind an additional popup/control.
  - Redo should remain available only until the next move is played.

## Notes For Next Session

- Start by reproducing each issue with browser checks on desktop and mobile.
- Do not implement achievements.
- Do not add more games.
- Keep drag/carry interactions intact while improving click-auto behavior.
- Run `npm test`, `npm run build`, and browser smoke checks after fixes.
