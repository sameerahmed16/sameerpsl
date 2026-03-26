

## Fix: Overall Leaderboard Showing "Entered" Instead of Points

### Problem
`renderEntries` uses `const isUpcoming = selectedMatchStatus === 'upcoming'` (line 236) for both the Overall and Per-Match tabs. If the currently selected match happens to be "upcoming", the Overall tab also shows "Entered" instead of total points.

### Fix
In `src/pages/Leaderboard.tsx`, line 268:
- Change the condition so "Entered" only shows when `showSquad` is true (per-match tab) AND the match is upcoming
- `{showSquad && isUpcoming ? 'Entered' : \`${entry.points.toLocaleString()} pts\`}`

This is a one-line fix on line 268.

