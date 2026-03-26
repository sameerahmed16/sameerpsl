

## Plan: Team Preview on Cricket Ground (Dream11-style)

### What
After saving a team (or viewing an existing one), show a cricket ground visualization with players positioned by role — WK at top, batsmen in the inner ring, all-rounders in the middle, bowlers at the bottom — with player names, C/VC badges, and team colors. Triggered via a "View Team" button or shown automatically after saving.

### UI Design
- Oval/circular green cricket ground with pitch lines in the center
- Players arranged in rows by role:
  - **WK** (1-4): top of the ground, behind the stumps
  - **BAT** (3-6): upper-mid section
  - **AR** (1-4): center section
  - **BOWL** (3-6): bottom/outfield section
- Each player shown as: avatar circle with initials + name label below + C/VC badge if applicable
- Team color indicators on each player circle
- Ground uses green gradient with darker checkerboard-style pattern and brown boundary ring (matching the reference image)

### Components
1. **`src/components/TeamPreview.tsx`** — New component
   - Props: `players`, `captainId`, `viceCaptainId`, `onClose`
   - Renders the cricket ground SVG/CSS layout
   - Groups players by role and positions them in rows
   - Shows C (gold) and VC (purple) badges
   - Includes a close/back button and share option
   - Responsive: fills the viewport as a modal/overlay

2. **`src/pages/MatchDetail.tsx`** — Add state & trigger
   - Add `showPreview` state
   - After successful save → set `showPreview = true`
   - Add "Preview Team" button (visible when team is complete, 11 selected with C & VC)
   - Render `<TeamPreview>` as a full-screen overlay when active

### Technical Details
- Ground built with pure CSS (radial gradients, borders) — no external images needed
- Player positioning uses CSS grid/flexbox rows within an aspect-ratio container
- Each role row is horizontally centered with equal spacing
- The overlay uses `fixed inset-0 z-50` with a dark backdrop
- Player initials derived from name (first letters of each word)
- Team abbreviation color from existing `TEAM_COLORS` map in `TeamLogo.tsx`

### Files
- **Create**: `src/components/TeamPreview.tsx`
- **Edit**: `src/pages/MatchDetail.tsx` (add preview state, button, overlay render)

