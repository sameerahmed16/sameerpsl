

## Plan: Complete Real-Time Match Lifecycle

### What Exists
- Team selection with credits, role constraints, C/VC — ✅
- Team preview on cricket ground — ✅
- Match listing (upcoming/live/completed tabs) — ✅
- Countdown + auto-lock at match start — ✅
- Basic global leaderboard (profiles.total_points) — ✅
- sync-live-scores edge function with scoring logic — ✅
- Realtime DB subscriptions — ✅
- Playing XI indicators — ✅

### What Needs Building

#### 1. Live Match Scoreboard & Player Points View
**File: `src/pages/MatchDetail.tsx`**
- When match is `live` or `completed`, replace team-selection UI with a **live scoreboard view**:
  - Match score prominently displayed (runs/wickets/overs for both teams)
  - Tab switcher: "My Team" / "All Players" / "Scorecard"
  - "My Team" tab: show user's 11 players with live fantasy points, C(2x)/VC(1.5x) multiplied
  - Total team points displayed prominently at top
  - Auto-refresh every 10 seconds during live matches (reduce `refetchInterval`)
- When match is `upcoming` and unlocked: show current team-selection UI (unchanged)

#### 2. Match-Specific Leaderboard
**File: `src/pages/MatchDetail.tsx`** (add tab) + **DB migration**
- Add a "Leaderboard" tab inside the live match view
- Query `user_teams` for the current match, joined with `profiles` for username
- Rank by `user_teams.total_points` descending
- Update in real-time via existing subscription

**DB change**: Add RLS policy to allow reading all user_teams for leaderboard (currently users can only view their own teams). Add a SELECT policy: `true` for completed/live matches.

#### 3. Points Computation with C/VC Multipliers
**File: `supabase/functions/sync-live-scores/index.ts`**
- After updating player points, recalculate each `user_team.total_points`:
  - Sum all team_players' points
  - Apply 2x for captain, 1.5x for vice-captain
  - Update `user_teams.total_points`
- Also update `profiles.total_points` as sum of all user's team points

#### 4. Faster Live Polling
**File: `src/pages/MatchDetail.tsx`**
- Change `refetchInterval` to `10000` (10s) when match is live, `30000` otherwise
- Add realtime subscription for `user_teams` table to get instant point updates

#### 5. Post-Match Finalization
**File: `supabase/functions/sync-live-scores/index.ts`**
- When match status changes to `completed`:
  - Freeze all player points (already happens naturally)
  - Final recalculation of all user_teams.total_points
  - Update profiles.total_points

#### 6. Leaderboard Page Enhancement
**File: `src/pages/Leaderboard.tsx`**
- Add match filter dropdown to view per-match rankings
- Show both "Overall" and per-match leaderboards
- Add realtime subscription for live updates

#### 7. Live Status Indicators on Match Card
**File: `src/components/MatchCard.tsx`**
- For live matches: show current score more prominently, add overs info
- For completed: show result text

### Files Summary
| Action | File |
|--------|------|
| Edit | `src/pages/MatchDetail.tsx` — live scoreboard view, faster polling, match leaderboard tab |
| Edit | `src/pages/Leaderboard.tsx` — per-match filter, realtime |
| Edit | `supabase/functions/sync-live-scores/index.ts` — C/VC multiplier calc, user_teams points, profiles update |
| Edit | `src/components/MatchCard.tsx` — enhanced live score display |
| Migration | Add SELECT policy on `user_teams` for leaderboard visibility |

### Technical Details
- Leaderboard RLS: `CREATE POLICY "Anyone can view teams for leaderboard" ON user_teams FOR SELECT TO authenticated USING (true);` (replace existing users-only policy)
- Points formula: `total = Σ(player.points) + captain.points * 1.0 + viceCaptain.points * 0.5` (captain already counted once in sum, add extra 1x; VC add extra 0.5x)
- Live polling: `refetchInterval: match?.status === 'live' ? 10000 : 30000`
- The sync-live-scores function already runs via pg_cron every minute — it will now also update user_teams and profiles

