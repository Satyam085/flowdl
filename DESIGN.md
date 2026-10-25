# FlowDL — Design Specification

## Visual Identity: Industrial Media Deck
A precision desktop media transfer utility. Replaces the generic AI SaaS dashboard aesthetic (purple glows, nested cards, emoji buttons) with the aesthetic of high-end media tools (HandBrake, LosslessCut, Linear desktop).

## Palette
- **Base Background**: `#0d1117` (Deep slate graphite)
- **Panel Surface**: `#161b22` (Secondary utility surface)
- **Elevated Control Surface**: `#21262d` (Inputs, buttons, segmented tracks)
- **Active / Hover Surface**: `#30363d`
- **Hairline Borders**: `rgba(240, 246, 252, 0.1)` (1px crisp dividers)
- **Primary Action**: `#2563eb` (Solid cobalt blue, hover `#1d4ed8`)
- **Semantic Status**:
  - In Progress: `#38bdf8` (Sky)
  - Remux / Encode: `#f59e0b` (Amber)
  - Completed: `#10b981` (Emerald)
  - Error: `#ef4444` (Coral red)
  - Cancelled / Idle: `#64748b` (Slate)

## Typography
- **Interface Font**: System UI sans-serif stack (`system-ui, -apple-system, "Segoe UI", Roboto, Cantarell, Ubuntu, sans-serif`)
- **Metric Font**: Monospace tabular numerals (`"JetBrains Mono", "Fira Code", monospace; font-variant-numeric: tabular-nums`)
- **Hierarchy**:
  - Window Toolbar Titles: 13px, weight 600
  - Item Titles: 13px, weight 500
  - Secondary Metadata & Labels: 12px, weight 400
  - Telemetry & Measurements: 11px, tabular numerals
  - Micro Badges: 10px, weight 600, uppercase letter-spacing +0.04em

## Anti-Patterns Banished
- Zero nested cards or floating colorful shadows.
- Zero emojis in buttons or status pills.
- Zero purple-to-cyan gradient backgrounds.
- Zero decorative blurred halos or glowing rings.
- Zero fake eyebrows or kickers over headings.
- Zero layout jitter from untabulated numbers during live downloads.
