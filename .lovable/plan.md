

## Plan: Update Role Constraints & Add Winning Team Bonus

### 1. Change minimum role constraints in `src/pages/MatchDetail.tsx`

Update `ROLE_CONSTRAINTS` from:
```
WK: [1, 4], BAT: [3, 6], AR: [1, 4], BOWL: [3, 6]
```
To:
```
WK: [1, 4], BAT: [1, 6], AR: [1, 4], BOWL: [1, 6]
```

BAT and BOWL minimums change from 3 to 1. WK and AR already at 1.

### 2. Add winning team bonus (+5 points) to scoring

This requires two changes:

**a. Database migration** — Add a `winning_team` column to the `matches` table so we can track which team won.

**b. Update `supabase/functions/sync-live-scores/index.ts`:**
- After parsing match result, store the winning team name in `matches.winning_team`
- In `calculatePoints`, accept a `isWinningTeam` boolean parameter
- Add `+5` points when the player belongs to the winning team

**c. Update scoring guide in `src/pages/Profile.tsx`** — Add "Winning team player: +5" to the displayed scoring list.

### Technical details
- The sync-live-scores function already parses match status; we'll extract the winning team from the API response and store it
- The `recalcUserTeamPoints` function doesn't need changes since it reads from `match_player_points` which will already include the +5

