# DESIGN.md

# Klinefelter Game Portal Design System

## Design Intent

Klinefelter Game is a compact collection of casual web games that should feel like bright, friendly mobile arcade toys. The portal, settings, offline manager, game HUDs, and individual games should share one visual language: warm backgrounds, rounded controls, bold readable labels, thick borders, soft shadows, and immediate playful feedback.

The stack is Vite, TypeScript, DOM/CSS UI, Canvas 2D for Drift Arena, localStorage settings/scores, and Web Audio API sound effects. The design system should stay lightweight: CSS variables, plain DOM classes, Canvas color constants, no remote fonts, no image dependency for core UI.

## Creative Direction

Use a polished 2D toy-arcade style:

- Casual mobile arcade
- Warm peach and coral backgrounds
- Rounded, chunky shapes
- Thick dark outlines
- Bright team colors
- Simple readable game objects
- Centered playable areas
- Friendly competition
- Bouncy, fast interactions

Avoid dark cinematic themes, realistic textures, glassy dashboard UI, complex gradients, fragile thin outlines, and long instructional copy inside game screens.

## Color Tokens

Core CSS tokens should live in `src/ui/styles/main.css`.

- Page background: `#F39478`, `#EF806C`, `#F7A082`
- Surface panels: `#FFF3E8`, `#FFE2D0`
- Panel/header dark: `#694046`, `#75474E`
- Text: `#3F2A2E`
- Muted text: `#7D5658`
- Border/outline: `#4B3035`
- Player blue: `#23C7F4`
- Player red: `#FF5B5B`
- Player green: `#82DE47`
- Player yellow: `#FFD529`
- Success: `#36C66F`
- Warning: `#FFD529`
- Danger: `#FF5B5B`

Use dark cocoa for outlines and top bars. Use white text on dark cocoa or strong player-color buttons.

## Shape And Depth

- Buttons: rounded 12-16px corners, bold labels, darker bottom edge, clear pressed state.
- Cards and panels: rounded 16-20px corners, 2px dark borders, soft toy-like drop shadows.
- Game boards: thick borders, inset warm surfaces, centered and oversized.
- Corner controls: circular or pill-like, large tap targets.
- Gameplay objects: simple silhouettes, thick outlines, bright fills, small highlights.

Depth should be simple 2D depth: drop shadows, darker lower edges, small highlights. Avoid heavy blur and realistic lighting.

## Typography

Use system fonts only to keep the app low-data and dependency-free. Treat text as rounded and playful through weight, casing, spacing, and scale.

- Important UI labels: uppercase, 700-900 weight.
- Scores: large and bold.
- Descriptions: short, high contrast, not tiny.
- Gameplay copy: minimal.

Good labels: `PLAY`, `RETRY`, `SCORE`, `YOU`, `BOT`, `VS`, `READY`, `WIN`.

## Layout

Default layout:

1. Warm full-screen background.
2. Compact dark top bar.
3. Main content centered.
4. Game cards or game board in a strong central area.
5. Settings/offline panels as simple stacked rounded sections.
6. Controls near the bottom or in corners.

Mobile-first rules:

- Use 46px or larger tap targets.
- Avoid nested cards.
- Keep game boards responsive with stable aspect ratios.
- Keep first screen useful, not marketing-heavy.

## Components

### Buttons

Buttons should feel like soft arcade buttons. Use bright primary buttons and warm secondary buttons.

- Primary: player blue or red/coral fill, dark outline, white bold text.
- Secondary: cream surface, dark outline, cocoa text.
- Disabled: muted cream/gray, no glow, no hover lift.

### Game Cards

Launcher cards are toy tiles:

- Cream surface on warm background.
- Thick dark border.
- Rounded corners.
- Large game title.
- Compact status chips.
- Personal best chip visible and friendly.

### Score Panels

Score panels should be compact and top-aligned when possible:

- Cocoa background.
- White score text.
- Team-color labels.
- Rounded pill segments.

### Modals And Banners

Use floating cream or cocoa panels with thick border and soft shadow. Update/install prompts should be clear but not severe.

## Game-Specific Guidance

### 2048

Keep the board warm and tactile. Tiles should be high-contrast rounded squares with bold numbers and a small pop animation. Score boxes should look like compact arcade counters.

### Minesweeper

Cells should look like soft square buttons. Hidden cells use cream/coral shading, revealed cells use lighter cream, mines and flags use strong colors. Board borders should be thick and rounded.

### Drift Arena

Canvas visuals should be toy-like and top-down:

- Arena floor: warm sand/peach.
- Walls: dark cocoa/coral outline.
- Player car: bright blue.
- Bots: red/yellow/green.
- Tokens: yellow star-like collectibles.
- HUD: dark cocoa rounded panels.

## Motion And Audio

Motion should be instant, short, and satisfying:

- Buttons depress slightly on tap.
- Cards lift subtly on hover.
- Tiles pop on spawn/merge.
- Errors shake softly.
- Positive moments pulse or sparkle.

Audio should use short procedural Web Audio sounds only. Respect `audioEnabled` and `soundEffectsEnabled`.

## Implementation Rules

- Prefer CSS variables over repeated raw colors.
- Keep all UI styling in `main.css`.
- Keep Canvas palettes in renderer constants.
- Do not add remote font or image dependencies for core UI.
- Keep design changes accessible: contrast, tap target size, and readable text first.
- Any new game should first follow this design system, then add game-specific flavor.

## One-Sentence Summary

Klinefelter Game should look like a connected collection of bright, rounded, top-down mobile arcade games with warm coral backgrounds, thick outlined toy objects, bold team colors, simple UI, and satisfying snappy feedback.
