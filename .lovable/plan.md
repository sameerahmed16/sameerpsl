

## Plan: Update Scoring System & Budget

### Summary
1. Update the `calculatePoints` function in `sync-live-scores` to match the new scoring table
2. Add `starting_xi` bonus (+4) and `motm` (+30) support
3. Change budget from 100 → 85 for future matches only (based on match date)
4. Update the Scoring Guide in the Profile page
5. Re-invoke sync to recalculate points for the current live match

### Scoring Changes (Current + Future Matches)

Current → New values:

| Category | Current | New |
|----------|---------|-----|
| Starting XI | not tracked | +4 |
| Run | +1 | +1 (same) |
| Four | +1 bonus | +4 total (boundary worth 4 extra) |
| Six | +2 bonus | +6 total (six worth 6 extra) |
| 25 runs | not tracked | +8 |
| Fifty | +8 | +8 (same) |
| Century | +16 | +16 (same) |
| Duck | -2 | -2 (same) |
| SR ranges | same thresholds | same values |
| Wicket | +25 | +30 |
| 3-wicket | +4 | +4 (same) |
| 4-wicket | +8 | +8 (same) |
| 5-wicket | +16 | +16 (same) |
| Maiden | +12 | +12 (same) |
| Economy ranges | same | same |
| Catch | +8 | +8 (same) |
| Stumping | +12 | +12 (same) |
| Run out direct | +12 | +12 |
| Run out indirect | not split | +6 |
| MOTM | not tracked | +30 |

### Budget Change (Future Matches Only)

In `MatchDetail.tsx`, change `BUDGET` from a constant `100` to a function that checks the match date. Matches starting after today (2026-03-27) use 85 credits; the current live match keeps 100.

### Files

| Action | File | What |
|--------|------|------|
| Edit | `supabase/functions/sync-live-scores/index.ts` | Update `calculatePoints()` with new values; add starting_xi bonus in `computePlayerPoints` |
| Edit | `src/pages/MatchDetail.tsx` | Dynamic budget: 100 for current match, 85 for future |
| Edit | `src/pages/Profile.tsx` | Update Scoring Guide display |

### Technical Notes
- **Starting XI bonus**: Applied in `computePlayerPoints` — every player found in the scorecard gets +4 added to their calculated points
- **MOTM**: Cricbuzz HTML includes "Player of the Match" info; we'll parse it and add +30. If not parseable, skip (admin can set manually)
- **Run out split**: The current `runOuts` field doesn't distinguish direct/indirect from Cricbuzz data, so we keep +12 for all run outs (same as direct) — admin can override via manual scoring
- **Budget logic**: `const BUDGET = match && new Date(match.match_date) > new Date('2026-03-28') ? 85 : 100;`
- After deploying, invoke `sync-live-scores` to recalculate all current match points with the new scoring

