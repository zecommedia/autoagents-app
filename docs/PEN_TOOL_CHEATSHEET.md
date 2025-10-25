# 🎨 Pen Tool Quick Reference Card

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PHOTOSHOP PEN TOOL - CHEAT SHEET                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ BASIC OPERATIONS                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLICK                  →  Corner Point (góc nhọn)                          │
│  ●                         Straight lines between                            │
│  │                                                                           │
│  └──●                                                                        │
│                                                                              │
│  CLICK-DRAG             →  Smooth Point (cong mượt)                         │
│  ●────○                    Symmetric handles                                 │
│   ╲                        Bezier curves                                     │
│    ╲                                                                         │
│     ●                                                                        │
│    ╱                                                                         │
│   ╱                                                                          │
│  ○                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ KEYBOARD SHORTCUTS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Alt/Option                                                                  │
│  ───────────                                                                 │
│  • Alt + Drag handle    →  Break symmetry (independent handles)             │
│  • Alt + Click smooth   →  Remove handles (convert to corner)               │
│  • Alt + Drag corner    →  Create new handles                               │
│                                                                              │
│  ●────○  →  Alt+Drag  →  ●────○                                            │
│   ╲                           ╲                                              │
│    ○                            ○ (independent)                              │
│                                                                              │
│  Ctrl/Cmd (⌘)                                                               │
│  ─────────────                                                               │
│  • Ctrl + Click anchor  →  Direct select & drag anchor                      │
│  • Ctrl + Drag handle   →  Adjust handle independently                      │
│  → Temporary selection, no tool switch needed!                              │
│                                                                              │
│  Shift (⇧)                                                                  │
│  ──────────                                                                  │
│  • Shift + Drag handle  →  Constrain to 45° angles                         │
│  → 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°                             │
│                                                                              │
│  Space (␣)                                                                  │
│  ──────────                                                                  │
│  • Space while dragging →  Reposition anchor before release                 │
│  → Fix placement mistakes on the fly!                                       │
│                                                                              │
│  Backspace/Delete (⌫)                                                       │
│  ─────────────────────                                                       │
│  • Remove last anchor point                                                  │
│  • Go back one step                                                          │
│                                                                              │
│  Esc (⎋)                                                                    │
│  ────────                                                                    │
│  • < 3 points → Cancel                                                      │
│  • ≥ 3 points → Finish and apply (don't close loop)                        │
│                                                                              │
│  Enter (↩)                                                                  │
│  ──────────                                                                  │
│  • ≥ 3 points → Close and apply immediately                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ VISUAL FEEDBACK                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Anchor Points                                                               │
│  ──────────────                                                              │
│  □   Normal (white + blue)                                                   │
│  ■   First/Last (has inner fill)                                            │
│  ⬚   Hover (orange highlight)                                               │
│  ◉   Near first point → Close cursor                                        │
│                                                                              │
│  Control Handles                                                             │
│  ────────────────                                                            │
│  ○···□   Dashed line + small circle                                         │
│  ●···□   Hovered (orange + larger)                                          │
│                                                                              │
│  Path                                                                        │
│  ────                                                                        │
│  ━━━━━   Solid blue curve                                                   │
│  ┅┅┅┅┅   Dashed preview to mouse                                           │
│  ┄┄┄┄┄   Dashed closing line (near first)                                  │
│  ▒▒▒▒▒   Light blue fill                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ GOLDEN RULES                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. FEWER POINTS = BETTER                                                    │
│     ────────────────────────                                                 │
│     ❌ Many anchors + short handles  =  Jagged, hard to edit                │
│     ✅ Few anchors + long handles    =  Smooth, easy to edit                │
│                                                                              │
│  2. PLACE AT CURVATURE EXTREMA                                              │
│     ───────────────────────────────                                          │
│     ✅ Where curve direction changes                                        │
│     ✅ At sharp corners                                                     │
│     ❌ Middle of flat segments                                              │
│                                                                              │
│  3. DRAG OPPOSITE THE BULGE                                                 │
│     ───────────────────────────────                                          │
│     Want curve to bulge UP?    → Drag handle DOWN                           │
│     Want curve to bulge RIGHT? → Drag handle LEFT                           │
│     → Incoming handle = opposite of drag direction!                         │
│                                                                              │
│  4. KEEP HANDLES COLLINEAR                                                  │
│     ───────────────────────────                                              │
│     Smooth points: Handles at 180° (straight line through anchor)            │
│     Only break with Alt when you REALLY need a cusp/corner                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ COMMON PATTERNS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  C-CURVE                 S-CURVE                HEART                        │
│  ───────                 ───────                ─────                        │
│      ○                       ○                    ●                          │
│     ╱                       ╱                    ╱ ╲                         │
│  ●─┘                     ●─┘                  ○─┘   └─○                     │
│  │                       │╲                    │       │                     │
│  │                       │ ╲                   │       │                     │
│  └─●                     │  ●                   ╲     ╱                      │
│     ╲                    │ ╱                     ○───○                       │
│      ○                   └○                       ●                          │
│                                                                              │
│  2 smooth points         3 points               5 points                     │
│  Drag same direction     Alt on middle          Mix corner + smooth          │
│                          to break handles                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ WORKFLOW                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PLAN      →  Look at shape, identify curvature extrema                  │
│  2. DRAW      →  Click-Drag with minimal anchors                            │
│  3. REFINE    →  Ctrl to adjust, Alt to break handles                       │
│  4. CLOSE     →  Click first point or Enter/Esc                             │
│                                                                              │
│  "Measure twice, cut once" - Plan before placing anchors!                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TROUBLESHOOTING                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Problem: Curve bulges wrong direction                                       │
│  → Remember: Drag OPPOSITE the bulge you want!                              │
│                                                                              │
│  Problem: Path is jagged                                                     │
│  → Too many anchors. Delete some, extend handles.                           │
│                                                                              │
│  Problem: Sharp corner instead of smooth curve                               │
│  → Point is corner type. Alt+Drag to create handles.                        │
│                                                                              │
│  Problem: Can't make S-curve                                                │
│  → Use Alt to break handle symmetry at inflection point.                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║  TIP: Practice with simple shapes first! Circle, square, heart, letter S.   ║
║       Master the handle directions before complex paths.                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Quick Mnemonic

**"OPPOSITE BULGE"** - Drag opposite the direction you want the curve to bulge
**"FEW & LONG"** - Fewer anchors with longer handles = smoother paths
**"EXTREMA ONLY"** - Place anchors at curvature extremes, not mid-segment

---

## Emergency Help

Stuck? Remember these 3 keys:
- **Ctrl** = Fix it (temporary selection)
- **Alt** = Break it (independent handles)
- **Esc** = Cancel it (start over)

---

Print this out and keep it next to your workspace! 🖨️
