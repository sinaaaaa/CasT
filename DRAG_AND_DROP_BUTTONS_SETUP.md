# Drag-and-Drop Action Buttons + Editable Queue

The four action buttons (**Forward**, **Backward**, **Turn Left**, **Turn Right**) are
dragged into the action-queue panel (the yellow strip) instead of being clicked, and the
user can now **edit the queue** before pressing Run:

- A dimmed **placeholder block** appears in the queue while you drag — the existing
  queued blocks **smoothly slide left/right** to make room, so you can see exactly where
  the new block will land before you release. Drop between any two blocks to insert in
  the middle of the program.
- Each user-added block in the queue has a **close button** (X) on its top-right
  corner. Click it to delete that block — the block **shrinks and fades out** while
  the neighbours slide in to fill the gap.
- Each user-added block in the queue can also be **picked up and dragged to a new
  position** in the program (Scratch-style reorder). The neighbours slide aside the
  same way they do for new drops.
- **Drag a queued block off the yellow strip and release** to throw it away
  (Scratch-style "drag off the script area to delete"). The block fades and shrinks
  away wherever you released it. Disable by unticking `Drag Out Queued To Delete`.
- **The currently-executing block lights up** while the robot is running so kids can
  follow the program one step at a time.
- **Dropped blocks bounce a tiny bit** when they land — both new inserts and reordered
  blocks — for satisfying drop feedback.
- **Touch-friendly out of the box.** `EventSystem.pixelDragThreshold` is raised on
  Start so a finger tap on a small button (e.g. the close X) doesn't accidentally
  trigger a drag. Works on iOS, Android, Windows touch and the WebGL build.

No Inspector setup is required for the default behaviour; everything is auto-wired at
runtime. To make the **entire yellow strip** the drop zone, see "Making a bigger drop
area" below.

## Files involved

- `Assets/Scripts/DraggableActionBlock.cs` — auto-attached to each of the four action
  buttons. Spawns a ghost icon while dragging and feeds the cursor position + the
  block's sprite to the drop zone so the animated placeholder can follow.
- `Assets/Scripts/DraggableQueuedBlock.cs` — auto-attached to each user-added queued
  block so it can be picked up and dragged to a new index in the program. Drives the
  same drop-zone placeholder so the slide-aside animation is identical to an
  insert-from-source-button drag. Snaps back to the original index when released
  outside the drop zone.
- `Assets/Scripts/ActionQueueDropZone.cs` — auto-attached to either `dropZonePanel`
  (if set) or `actionQueueTransform`. Spawns/animates the dimmed placeholder block
  inside the queue and, on drop, either inserts a new block (if a source button was
  dragged) or reorders the existing block (if a queued block was dragged).
- `Assets/Scripts/QueuedActionRef.cs` — lightweight tag added to every block
  instantiated in the queue. Stores the underlying `CharacterAction` and whether the
  block is user-removable so the queue can be rebuilt deterministically from the UI
  after edits.
- `Assets/Scripts/QueueInsertionPlaceholder.cs` — marker component placed on transient
  blocks (drag-in placeholder + shrink-out animation on remove) so the run loop and
  queue rebuild logic always skip them.
- `Assets/Scripts/CharacterMove.cs`
  - New fields:
    - `useDragAndDropForActions` (bool, default `true`).
    - `dropZonePanel` (RectTransform, optional).
    - `addCloseButtonsToQueuedBlocks` (bool, default `true`).
    - `allowReorderQueuedBlocks` (bool, default `true`).
    - `closeButtonSprite` (Sprite, optional) — when set the sprite IS the close button
      (no extra glyph is drawn over it) and the button is tinted white.
    - `closeButtonColor`, `closeButtonGlyphColor` — used only when no sprite is set.
    - `closeButtonSize` (default **36**), `closeButtonOffset`, `closeButtonOverhang`.
  - New public API:
    - `InsertActionFromDrag(kind, uiIndex)` — used by the drop zone for source-button drops.
    - `EnqueueActionFromDrag(kind)` — convenience wrapper that appends at the end.
    - `RemoveQueuedBlock(blockGameObject)` — called by the close button.
    - `IsActionQueueLocked()` — used by `DraggableQueuedBlock` to block reorders during a Run.
    - `OnQueuedBlockPickedUp()` / `OnQueuedBlockReordered()` — called by
      `DraggableQueuedBlock` so the execution queue stays in sync with the visual order.
  - `EnqueueAction(...)` now has an overload with a `deletable` flag. User-added blocks
    pass `true` (and also get the close button + the drag-to-reorder behaviour);
    guided/pre-loaded blocks remain non-deletable and non-draggable.
  - Internals: `RebuildActionQueueFromUI()`, `CleanupInsertionPlaceholders()`,
    `DestroyFirstNonPlaceholderQueueChild()`, `ShrinkAndDestroyBlock(...)`,
    `AttachQueuedBlockDragBehaviour(...)`.

## How it behaves

### Adding a block

1. Press and hold on one of the four action buttons.
2. A translucent ghost of the icon follows the cursor while you drag.
3. As soon as the cursor enters the drop zone, a dimmed copy of the block grows into the
   queue at the cursor's position. The existing queued blocks slide aside smoothly to
   make room (the LayoutGroup reflows each frame as the placeholder's width animates).
4. Move the cursor between different pairs of blocks: the placeholder re-anchors to the
   new index and the layout reflows again.
5. Release over the queue: the placeholder is replaced by the real action block at the
   exact same index.
6. Release outside the drop zone: the placeholder shrinks back out of the queue (with
   neighbours sliding back into place) and is then destroyed.

### Deleting a block

1. Click the **X** in the top-right corner of a block.
2. The block is immediately dropped from the execution queue, then visually shrinks and
   fades to nothing while the neighbours slide in to fill the gap (~150 ms).
3. The close button is only present on blocks the user added. Pre-loaded guided-level
   blocks have no close button and cannot be removed.

### Reordering a block

1. Press anywhere on the block body and start dragging it.
2. The block lifts out of the queue, becomes semi-transparent and slightly scaled up,
   and follows the cursor. A placeholder fills the gap it left behind.
3. As you move the cursor over different positions in the queue, the placeholder
   re-anchors to the new index and the existing blocks slide aside to make room.
4. Release over the queue (or the yellow strip): the block is reparented back into the
   queue at the placeholder's index. The execution queue is rebuilt to match, the block
   does a tiny scale-pop ("bounce") to acknowledge the drop.
5. Release outside the drop zone: by default the block is **deleted** (fades & shrinks
   wherever you released it) — Scratch-style. Set `Drag Out Queued To Delete = false`
   on `CharacterMove` to make it snap back to its original position instead.
6. Reorder is disabled during a Run (`IsActionQueueLocked()` returns true). Pre-loaded
   guided blocks (non-deletable) cannot be reordered either.

> **Click vs drag on the X.** The close button is a child of the block. If you press
> the X and immediately release, the block is deleted. If you press the X and move the
> cursor more than the EventSystem's drag threshold, Unity starts a reorder drag on
> the parent block instead — the close-button click is suppressed and you can drop the
> block at a new position. This matches Scratch-style block UX.

### Editing a block

There is no "in-place edit" — to change a block, click its **X** and drag the desired
button in at the same position. The insertion indicator makes it easy to drop in exactly
the same slot.

### Gating

- During a **Run** (`isProcessing`), inserts, deletes and reorders are ignored. The Run
  animation destroys blocks one-by-one as before.
- In **guided levels with blanks**, the four buttons become non-interactable while
  blanks are active, so drag-and-drop won't fire. Inserts respect this with
  `IsKindInteractable(kind)`.
- Pre-loaded guided actions have `deletable = false`. They have **no** close button and
  **no** reorder-drag handler, so the queue stays faithful to the level definition.

### Analytics

The chronological `playerActions` and `currentAttemptActionLog` logs are preserved:

- A drag-insert appends the action label (`forward` / `backward` / `left` / `right`) at
  the moment of insertion, regardless of where in the queue it landed.
- A delete appends `remove:<label>` so analytics can see the user retracted a block.
- A reorder (pick a queued block up and drop it at a new index) appends `reorder`.
- A pick-up that is cancelled (released outside the drop zone) does **not** log an
  event — there was no net change.

The execution queue itself is rebuilt from the UI order via `RebuildActionQueueFromUI()`,
so `ProcessActions` always runs the user's final visible program.

## Making a bigger drop area (e.g. the whole yellow strip)

By default the drop zone covers only the inner `actionQueueTransform`. To make the
**entire yellow bottom strip** accept drops:

1. Select the `CharacterMove` GameObject (the robot in the scene).
2. In the **Drag & Drop Input** section, drag the yellow strip RectTransform from the
   Hierarchy into the **Drop Zone Panel** field.
3. Press Play. The script auto-attaches the `ActionQueueDropZone` to the strip and keeps
   it active so the entire strip becomes a valid drop target. Other children of the
   strip (the Run button, the queued blocks themselves) don't block the drop because
   they don't implement `IDropHandler`.

The insertion line is still drawn relative to `actionQueueTransform` regardless of where
the drop zone lives, so the indicator always lands between blocks.

## Look-and-feel tuning

All on the `CharacterMove` component (under **Drag & Drop Input**):

| Field | Effect |
|------|--------|
| `Use Drag And Drop For Actions` | Turn the whole drag-and-drop system on/off. When off, the original click-to-enqueue behaviour is restored and no close buttons, placeholder, or reorder-drag are added. |
| `Drop Zone Panel` | Optional RectTransform that should accept drops (e.g. the yellow strip). Leave empty to use `actionQueueTransform`. |
| `Add Close Buttons To Queued Blocks` | Hide/show the X buttons on user-added blocks. |
| `Allow Reorder Queued Blocks` | When ticked (default), user-added blocks can be picked up and dragged to a new position in the queue. Untick to disable reordering (close buttons + insert-from-source still work). |
| `Touch Friendly Drag Threshold` | Min `pixelDragThreshold` (px) forced on the EventSystem at Start. Default 14 — finger-friendly. Set to `0` to leave Unity's default (10 px) alone. |
| `Drag Out Queued To Delete` | When ticked (default), dragging a queued block off the drop zone and releasing **deletes** it (Scratch-style). When unticked, the block snaps back to its original index. |
| `Highlight Executing Block` | Tint the block currently running with `Executing Block Highlight Color` so kids can follow execution. |
| `Executing Block Highlight Color` | Tint colour. |
| `Enable Drop Bounce` | When ticked (default), a block that lands in the queue (insert OR reorder) plays a small scale-pop animation. |
| `Drop Bounce Amount` | Peak extra scale during the bounce. `0.15` = 115% at the peak. |
| `Drop Bounce Duration` | Duration of the bounce in seconds. |
| `Close Button Sprite` | Custom sprite. **When set the sprite IS the close button**; no extra X glyph is drawn over it and the tint is white. |
| `Close Button Color` | Background tint when no `Close Button Sprite` is assigned. |
| `Close Button Glyph Color` | Colour of the programmatic X (only used when no sprite is assigned). |
| `Close Button Size` | Pixel size of the close button (square). Default **36**. If your sprite still looks small, raise this. |
| `Close Button Offset` | How far the button sits from the top-right corner of the block (px). |
| `Close Button Overhang` | When `true` the button hangs OUT of the corner by `Close Button Offset`. When `false` the button is inset INSIDE the block by that amount. |

On the `ActionQueueDropZone` component:

| Field | Effect |
|------|--------|
| `Highlight Target` | An Image whose color is tinted while a block hovers the zone. |
| `Highlight Color` | The tint to apply. |
| `Placeholder Alpha` | Opacity of the dimmed make-room block. 0 = invisible, 1 = solid. |
| `Placeholder Animation Duration` | Seconds for the placeholder to grow in / shrink out. Set 0 to disable the animation. |
| `Placeholder Target Width Override` | Force a specific width (px) for the placeholder. `0` means "use the action image prefab's natural width" (the usual choice). |

## Why the close button now actually changes size

The new code:

1. Sets `LayoutElement.ignoreLayout = true` on the close button so that even if your
   action-block prefab has a LayoutGroup it can't squash the close button.
2. Sets `Image.preserveAspect = false` and `Image.type = Simple` so a sprite with extra
   transparent padding gets stretched to the full button size instead of fitting itself
   inside.
3. Treats `Close Button Sprite` as the **whole** button (white tint, no extra X glyph
   drawn on top). If your sprite already looks like an X icon, you don't get two stacked
   Xs anymore.

If your image still looks small, raise `Close Button Size` on `CharacterMove`. The
default is now 36 px; you can go up to whatever fits your block size.

## Touch / mobile / WebGL

Everything is built on Unity's `EventSystem` interfaces (`IBeginDragHandler`,
`IDragHandler`, `IEndDragHandler`, `IDropHandler`, `IPointerEnter/ExitHandler`), which
fire identically for **mouse**, **touch**, and **pen** input through whatever Input
Module is on the `EventSystem` in your scene (`StandaloneInputModule` for legacy input,
`InputSystemUIInputModule` for the new Input System). The project has both Input
Systems enabled (`Active Input Handling = Both`).

What that means in practice:

- A tap on a button + drag-and-release on a touchscreen Just Works.
- `eventData.position` and `eventData.pressEventCamera` are used everywhere instead of
  `Input.mousePosition`, so DPI / Canvas / camera resolution are all handled.
- `EventSystem.pixelDragThreshold` is raised to `Touch Friendly Drag Threshold` on
  Start so a clumsy finger tap can't trigger a reorder by mistake.
- Multi-touch isn't actively supported (one drag at a time), but extra fingers won't
  break the system — they just won't open extra drags. Reorder of a queued block is
  refused (`isProcessing`) until the current run finishes anyway.

If touch feels too sensitive, raise `Touch Friendly Drag Threshold` to e.g. `20` or
`25`. If it feels unresponsive on a stylus / mouse-only build, lower it.

## Requirements (already in place for any Unity UI scene)

- A scene `EventSystem` GameObject.
- The Canvas containing the buttons must have a `GraphicRaycaster`.

## Troubleshooting

- **Nothing happens on drop.** Confirm the Canvas has a `GraphicRaycaster` and the scene
  has an `EventSystem`. Also check the Console for the warning
  `No drop-zone target available` — that means both `dropZonePanel` and
  `actionQueueTransform` are unset.
- **The buttons still enqueue on click.** Make sure `Use Drag And Drop For Actions` is
  ticked on `CharacterMove`, then re-enter Play mode (listeners are wired in `Start`).
- **Close buttons don't appear on blocks I just dropped.** Make sure
  `Add Close Buttons To Queued Blocks` is ticked. The flag affects only blocks added by
  the user; pre-loaded guided blocks never get close buttons by design.
- **The X is too small / wrong colour.** Tweak `Close Button Size`, `Close Button
  Color`, `Close Button Offset`, or assign your own `Close Button Sprite` on
  `CharacterMove`. Remember: if you assign a sprite, no programmatic X glyph is drawn,
  so the sprite IS the whole button.
- **Existing blocks don't slide — they snap.** The slide animation is produced by the
  parent `HorizontalLayoutGroup` reflowing as the placeholder's preferred width tweens.
  If the queue parent has no `HorizontalLayoutGroup` (or `Child Force Expand Width` is
  on), neighbours will snap. Either add a `HorizontalLayoutGroup` with
  `Child Control Size: Width = true` and `Child Force Expand: Width = false`, or set
  `Placeholder Target Width Override` to the natural block width on `ActionQueueDropZone`.
- **The placeholder appears with the wrong sprite.** It uses the dragged button's sprite,
  fed by `DraggableActionBlock.ResolveSprite()`. Make sure `forwardSprite`,
  `backwardSprite`, `rotateLeftSprite`, `rotateRightSprite` are all assigned on
  `CharacterMove`.
- **The ghost icon appears in the wrong place.** Assign `Root Canvas` on
  `DraggableActionBlock` (or `DraggableQueuedBlock`) explicitly if the button lives
  inside a nested canvas. Normally the script auto-detects the parent canvas.
- **Reordering doesn't work.** Check that `Allow Reorder Queued Blocks` is ticked on
  `CharacterMove`. Pre-loaded guided blocks (non-deletable) intentionally have no
  reorder handler; only user-added blocks are draggable.
- **Reordering "ate" my close-button click.** That's Unity's drag threshold kicking in.
  Press the X and release in place to delete; press anywhere on the block (including
  the X) and move further than the drag threshold to reorder. On touch screens the
  threshold is raised by `Touch Friendly Drag Threshold` so taps stay reliable; if it
  still feels twitchy on a particular device, raise that value further.
- **I want releasing outside the queue to snap back, not delete.** Untick
  `Drag Out Queued To Delete` on `CharacterMove`. The block then returns to its
  original index when released anywhere outside the drop zone.
- **The executing block isn't highlighting.** Make sure `Highlight Executing Block` is
  ticked. The block's `Image.color` is overwritten with
  `Executing Block Highlight Color` immediately before the action runs; the block is
  destroyed by `ProcessActions` once the action completes, so there's no need to
  restore the color.
