

## Fix: Missing winning team bonus (+5) and verify C/VC multipliers for completed matches

### Problem identified
Both completed matches have `winning_team = null` in the database, which means:
- **+5 winning team bonus** was never applied to any player
- **MOTM +30 bonus** was likely not extracted either
- This affects all 42 player point totals and cascades to all 32 user team totals and profile leaderboard points

The C/VC multiplier logic (2x captain, 1.5x vice-captain) in `recalcUserTeamPoints` is correct and already applied — the issue is the base player points are wrong.

### Match winners (from scores)
- **Peshawar Zalmi 214/4 vs Rawalpindi Pindiz 218/5** → **Rawalpindi Pindiz won** (chased 215, 11 players need +5)
- **Multan Sultans 171/8 vs Islamabad United 175/5** → **Islamabad United won** (chased 172, 10 players need +5)

### Plan

**1. Fix winning team extraction in sync-live-scores**
The `extractWinningTeam()` function fails when the Cricbuzz status text uses short team names (e.g. "Islamabad" instead of "Islamabad United"). Add fallback matching on first-word team names and partial matches.

**2. Add a "Recalculate Points" admin action for completed matches**
Currently the sync only processes `live` matches. Add a new edge function endpoint or modify `admin-update-scores` to accept a `recalculate: true` flag that:
- Re-fetches the scorecard from Cricbuzz for a completed match
- Recomputes all player points with correct winning team (+5) and MOTM (+30) bonuses
- Recalculates all user team totals with C/VC multipliers
- Updates profile leaderboard totals

**3. Set winning_team and recalculate for both matches**
- Update `matches` table: set `winning_team` for both completed matches
- Re-invoke the recalculation to add +5 to all winning team players
- Recalculate all 32 user_teams with corrected base points × C/VC multipliers
- Update all affected profile `total_points`

**4. Add "Recalculate" button to AdminScores UI**
Add a button next to each completed match that triggers the recalculation endpoint, so you can fix points without changing match status.

### Technical details

**Files to modify:**
- `supabase/functions/sync-live-scores/index.ts` — fix `extractWinningTeam()` to handle partial team name matches
- `supabase/functions/admin-update-scores/index.ts` — add `recalculate: true` mode that re-fetches scorecard and recomputes points
- `src/pages/AdminScores.tsx` — add "Recalculate" button per match

**Data updates (via edge function):**
- Match `e1b40bf5`: set `winning_team = 'Rawalpindi Pindiz'`
- Match `d4fefd70`: set `winning_team = 'Islamabad United'`
- +5 to each winning team player's match points
- Recalc all user_teams and profiles

