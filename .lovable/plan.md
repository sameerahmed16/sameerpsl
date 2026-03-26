

## Plan: Fix Live Scoring Pipeline & Leaderboard Accuracy

### Critical Issues Found

1. **Player mapping is broken**: All 11 players in the DB have `external_id = null`. The `updatePlayerStats` function matches scorecard data by `external_id` — so it will **never** update any player's points. This is the #1 blocker.

2. **CricAPI network is blocked**: Edge functions can't reach CricAPI directly (connection reset). The `http_get_json` RPC workaround exists but is unreliable. Need a more robust fallback chain.

3. **Points accumulation bug**: Batting points **overwrite** (`update({ points })`) while bowling/fielding **add** to existing points. If the sync runs multiple times per match, bowling and fielding points keep doubling but batting resets. All categories must use the same approach — compute total from scratch each sync.

4. **Realtime not enabled for leaderboard**: `user_teams` table is NOT in the `supabase_realtime` publication. Only `matches` and `players` are. Leaderboard can't get push updates.

5. **Only 11 of ~200 players in DB**: Most user teams reference fallback-generated UUIDs that don't exist in the `players` table, so `team_players → players(points)` joins return null.

### Fix Plan

#### 1. Seed All Players with External IDs
**Migration + Edge Function update**

- Create a new edge function `seed-players` that:
  - Fetches player lists from CricAPI for all PSL 2026 matches (using `match_squad` endpoint)
  - Inserts/upserts players into the `players` table with their CricAPI `external_id`
  - Falls back to inserting from `pslSquads.ts` data if API is unreachable
- On the frontend side, when saving a team, ensure `team_players.player_id` references actual DB player IDs (not fallback-generated ones)

**File: `src/pages/MatchDetail.tsx`**
- When saving a team, upsert players to DB first (if they don't exist), then reference the real DB IDs
- Match fallback players to DB players by name+team, not by generated UUID

#### 2. Fix Points Calculation — Compute from Scratch
**File: `supabase/functions/sync-live-scores/index.ts`**

- Reset all player points to 0 at the start of each sync cycle for that match
- Then apply batting + bowling + fielding points additively in a single pass
- This prevents accumulation bugs across multiple syncs
- Store per-match points in a new approach: track points per player per match

#### 3. Add `match_player_points` Table
**Migration**

Create a junction table that stores points per player per match (not on the global `players` table):

```text
match_player_points
  id          uuid PK
  match_id    uuid NOT NULL
  player_id   uuid NOT NULL
  points      integer DEFAULT 0
  UNIQUE(match_id, player_id)
```

This way:
- Each match has isolated scoring — no cross-match contamination
- The sync function upserts into this table instead of updating `players.points`
- `user_teams.total_points` calculation joins through this table
- The global `players.points` becomes a sum across all matches (or is deprecated)

#### 4. Enable Realtime on `user_teams`
**Migration**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_teams;
```

Then add realtime subscriptions on the frontend:
- `Leaderboard.tsx`: subscribe to `user_teams` changes for live rank updates
- `MatchDetail.tsx`: subscribe to `user_teams` for live "My Team" points

#### 5. Robust API Fallback Chain
**File: `supabase/functions/sync-live-scores/index.ts`**

Improve `apiFetch`:
- Try direct fetch first
- Then try `http_get_json` RPC
- Add request timeout (10s) to avoid hanging
- Log which method succeeded for debugging

#### 6. Frontend Player ID Reconciliation
**File: `src/pages/MatchDetail.tsx`**

When saving a team:
- Before inserting into `user_teams` + `team_players`, upsert each selected player into the `players` table using name+team as the unique key
- Use the returned DB `id` (not the fallback-generated one) for `team_players.player_id`, `captain_id`, `vice_captain_id`
- This ensures all references point to real DB records that the scoring pipeline can update

### Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/seed-players/index.ts` — bulk player seeding |
| Migration | Create `match_player_points` table with RLS |
| Migration | Add realtime for `user_teams` |
| Edit | `supabase/functions/sync-live-scores/index.ts` — fix points logic, use `match_player_points` |
| Edit | `src/pages/MatchDetail.tsx` — upsert players on save, use real DB IDs |
| Edit | `src/pages/Leaderboard.tsx` — add realtime subscription |

### Technical Details

- **Player upsert on save**: Use Supabase's `.upsert()` with `onConflict: 'name,team'` (requires adding a unique constraint on `(name, team)` in migration)
- **Points isolation**: `match_player_points` prevents the bug where a player's century in Match 1 inflates their score in Match 2
- **Realtime subscription pattern**:
  ```typescript
  supabase.channel('leaderboard')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_teams', filter: `match_id=eq.${matchId}` }, () => refetch())
    .subscribe()
  ```
- **Sync flow**: CricAPI scorecard → compute all points from scratch → upsert into `match_player_points` → recalc `user_teams.total_points` → update `profiles.total_points`

