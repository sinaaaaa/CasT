# Responsive UI Setup (Phone / iPad / PC / WebGL)

Goal: the layout shown in your mockup (GOAL top-left, COMMANDS left, action queue bottom, RUN bottom-right, LEVEL top-right, gear top-right, grid centered) should look the same on every device.

You already have three helpers:

- `ResponsiveCanvasScaler.cs` — sets `CanvasScaler` match value based on aspect.
- `SafeAreaFitter.cs` — keeps UI clear of notches / browser chrome on mobile.
- `AspectRatioLockedFitter.cs` — keeps the grid area a perfect square.

---

## 1. Canvas hierarchy

You need **TWO** canvases. A single Overlay canvas can't host both a background and a 3D world correctly, because Overlay always draws on top of the camera output (so the background hides the grid).

```
Scene Root
├── BackgroundLayer  (empty GameObject + BackgroundLayer.cs)
│      └── auto-creates a Canvas (Screen Space - Camera, plane distance = 100,
│          sorting order = -1000) with a CanvasBackgroundImage inside.
│          Sits BEHIND the 3D scene.
│
├── Main Camera  (renders the 3D grid / robot / objects)
│
└── UI Canvas (Screen Space - Overlay)        <-- the layout you saw in the mockup
    ├── ResponsiveCanvasScaler                <-- script
    ├── CanvasScaler                          <-- Unity component
    └── SafeArea  (anchors 0,0 -> 1,1)
        ├── SafeAreaFitter                    <-- script
        ├── TopBar      (anchored top-left/right)
        │   ├── GoalPanel       (anchor: TopLeft)
        │   ├── LevelBadge      (anchor: TopRight)
        │   └── SettingsButton  (anchor: TopRight)
        ├── LeftBar             (anchor: stretch vertically on the left)
        │   └── CommandsPanel
        ├── BottomBar           (anchor: stretch horizontally at the bottom)
        │   ├── QueueArea
        │   └── RunButton       (anchor: BottomRight)
        └── GameAreaFrame       (anchor: stretch all, between panels)
            ├── AspectRatioLockedFitter  (script, aspect = 1)
            └── (leave EMPTY — the grid is rendered by the 3D camera)
```

> The `GameAreaFrame` is a **layout placeholder** — it reserves a square region of the screen for the grid so the side panels don't overlap it. The actual grid is drawn by the 3D `Main Camera`, which sits behind this Overlay canvas and in front of the `BackgroundLayer` canvas.

## 2. Canvas component settings

On the root `Canvas`:
- **Render Mode**: `Screen Space - Overlay` (simplest) **or** `Screen Space - Camera` if you want the 3D camera to render behind it.
- Add `Canvas Scaler` component (Unity will warn if you forgot it).

On `Canvas Scaler` (the values are overridden by `ResponsiveCanvasScaler` at runtime, but set sensible defaults):
- UI Scale Mode: `Scale With Screen Size`
- Reference Resolution: `1920 x 1080`
- Screen Match Mode: `Match Width Or Height`
- Match: `0.5`
- Reference Pixels Per Unit: `100`

Now add `ResponsiveCanvasScaler` to the same GameObject. Default values are fine.

## 3. Anchor each panel correctly

Anchors are the secret to a layout that works on any size. Use the **anchor presets** popup in the top-left of the RectTransform inspector — hold **Shift + Alt** while clicking a preset to set both anchor and position at once.

| Panel             | Anchor preset                | Notes                                              |
|-------------------|------------------------------|----------------------------------------------------|
| `GoalPanel`       | Top-Left                     | Set fixed `Width / Height`, position from corner   |
| `LevelBadge`      | Top-Right                    | Same idea, mirrored                                |
| `SettingsButton`  | Top-Right                    | Just below or beside the level badge               |
| `CommandsPanel`   | Stretch vertically, left     | `anchorMin = (0, 0)`, `anchorMax = (0, 1)`         |
| `QueueArea`       | Stretch horizontally, bottom | `anchorMin = (0, 0)`, `anchorMax = (1, 0)`         |
| `RunButton`       | Bottom-Right                 | Fixed size                                         |
| `GameAreaFrame`   | Stretch all (full screen)    | `anchorMin = (0,0)`, `anchorMax = (1,1)`           |

DO NOT use `Top` preset and then drag the panel around with fixed pixel offsets — that breaks on small screens. Always use a corner preset and a fixed width/height.

## 4. Game grid stays a square

On `GameAreaFrame`:
- Make it **stretch to fill the area between the left bar, top bar and bottom bar** (set margins via offsetMin/offsetMax so it doesn't overlap them).
- Add `AspectRatioLockedFitter` with `aspect = 1`. This forces the grid background image to always be a square, centered in the available space, never stretched.

Put the actual `GridBackgroundImage` inside `GameAreaFrame` with anchors `0,0` to `1,1` and offsets `0,0,0,0` — it will automatically follow the square fitter.

## 5. Camera

You're using `MultiTargetCamera` to frame the grid + robot. It already auto-fits its orthographic size / distance to the bounds, so on different aspect ratios the world camera will widen or zoom in to keep everything visible. Nothing extra needed.

If you use `Screen Space - Camera` mode for the Canvas, plug the same `Camera` into the Canvas's `Render Camera` field.

## 6. Player Settings (Project Settings → Player → WebGL)

- **Resolution and Presentation**
  - Default Canvas Width / Height: `1280 x 720` (just an initial hint; CSS will resize it)
  - Run In Background: ON
  - WebGL Template: `Default` is fine; you can also use `Minimal`.
- **Other Settings**
  - Color Space: `Linear` (looks better; check that your shaders support it)
  - Auto Graphics API: ON
- **Publishing Settings**
  - Compression Format: `Brotli` (smaller) or `Gzip` (more compatible)
  - Decompression Fallback: ON if your host can't set headers

## 7. Make the WebGL page fill the browser

Open `Assets/WebGLTemplates/<your-template>/index.html` (or copy the default template into `Assets/WebGLTemplates/Responsive/`). Replace the inline canvas size with this CSS:

```html
<style>
  html, body { margin: 0; height: 100%; background: #161616; overflow: hidden; }
  #unity-container, #unity-canvas {
    position: absolute; inset: 0;
    width: 100% !important; height: 100% !important;
  }
</style>
```

Then in `Project Settings → Player → WebGL → Resolution and Presentation`, choose your template `Responsive`.

## 8. Orientation lock (optional, recommended for phones)

If the layout only makes sense in landscape, lock the orientation:

```js
// Add to index.html, inside <script> after the Unity loader finishes:
try {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(()=>{});
  }
} catch(e){}
```

Players using a portrait phone will see a "Please rotate your device" overlay if you also add a CSS media query:

```css
@media (orientation: portrait) {
  #rotate-hint { display: flex; }
  #unity-container { display: none; }
}
```

## 9. Quick test inside Unity

- Game view → top-left dropdown → add custom resolutions:
  - **Phone-landscape**: `2400 x 1080` (Galaxy/Pixel)
  - **iPhone-notch**:    `2778 x 1284` (iPhone Pro)
  - **iPad**:            `2048 x 1536`
  - **PC 16:9**:         `1920 x 1080`
  - **Ultrawide**:       `3440 x 1440`

Cycle through them — everything should reflow without any panel falling off-screen.

## 10. Final checklist before publishing

- [ ] Canvas has `ResponsiveCanvasScaler` + `CanvasScaler` (Scale With Screen Size).
- [ ] `SafeArea` child wraps all gameplay UI.
- [ ] Every panel uses a corner / edge anchor preset, not center+offset.
- [ ] `GameAreaFrame` has `AspectRatioLockedFitter`.
- [ ] WebGL Player Settings updated (Run In Background, compression).
- [ ] `index.html` makes `#unity-canvas` fill the viewport.
- [ ] Tested at: 1080p, iPad (4:3), iPhone (19.5:9), ultrawide (21:9).
