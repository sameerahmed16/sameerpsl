
Fix the scoring issue in two parts: correct the backend calculation/audit path, then update the UI so Captain/Vice-Captain differences are actually visible.

1. What I found
- The backend already recalculates team totals with multipliers: `recalcUserTeamPoints()` applies `2x` for captain and `1.5x` for vice-captain when writing `user_teams.total_points`.
- The mismatch is mainly in the UI: both `Leaderboard.tsx` expanded squads and the completed/live player lists display only base `match_player_points.points`, so C/VC players look the same as normal players.
- Fielding points are fragile because they are inferred from Cricbuzz dismissal text. The parsing is narrow, and the recalculation function has a simplified fielding parser, so catches/stumpings/run-outs can be missed or inconsistently applied.
- There is also no stored point breakdown, so it is hard to verify whether a player’s total came from batting, bowling, fielding, winning bonus, or MOTM.

2. Implementation plan
- Unify scoring logic so both live sync and admin recalculation use the same parser and the same point-calculation rules.
- Strengthen Cricbuzz fielding extraction:
  - catches
  - caught-and-bowled
  - stumpings
  - direct run-outs
  - multi-fielder run-outs
- Fix run-out scoring to match the intended rules instead of treating every involved fielder the same.
- Recalculate the two recently completed matches from Cricbuzz after the parser/scoring fix so stored points, user team totals, and leaderboard totals are refreshed.
- Update the UI to clearly show:
  - base player points
  - C or VC label
  - multiplied total for that user’s team where relevant
- Add a simple per-player breakdown display for completed matches so fielding and bonus points are visible instead of hidden inside one total.

3. Files to update
- `supabase/functions/sync-live-scores/index.ts`
  - centralize/fix dismissal parsing
  - fix fielding/run-out scoring
  - keep winner/MOTM bonuses consistent
- `supabase/functions/admin-update-scores/index.ts`
  - reuse the same parsing/scoring path as live sync
  - make recalculation return audit-friendly details
- `src/pages/MatchDetail.tsx`
  - show base vs multiplied points in “My Team”
  - show clearer scoring detail for completed matches
- `src/pages/Leaderboard.tsx`
  - show captain/vice-captain adjusted points in expanded squads, not only raw base points

4. Optional backend improvement I recommend
- Add a nullable JSON breakdown column on `match_player_points` so each recalculation can store components like:
  - batting
  - bowling
  - fielding
  - winning_bonus
  - motm_bonus
  - total
This will make future disputes easy to verify and fix.

5. Expected outcome
- Completed matches will have corrected player totals including missed fielding events.
- User team totals will continue using proper C/VC multipliers.
- The app will visibly distinguish base player points from captain/vice-captain adjusted totals.
- Leaderboard and match views will finally align with the scoring rules users expect.
