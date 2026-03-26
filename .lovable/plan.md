

## Audit: Discrepancies and Mismatches Found

After reviewing the database schema, constraints, RLS policies, edge functions, and frontend code, here are the issues discovered:

### Critical Issues

**1. No Triggers Exist — Profile Auto-Creation is Broken**
The `handle_new_user()` function exists but no trigger is attached to `auth.users`. New signups will NOT create a profile row, causing the leaderboard and username display to fail silently.

**Fix**: Create the trigger via migration: `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();`

**2. Admin Page Cannot Update Matches (RLS Blocks It)**
The `matches` table has NO `UPDATE` policy for authenticated users. When the admin saves scores via `AdminScores.tsx`, the `.update()` call silently fails due to RLS. The admin page uses the anon key (client-side), not the service role key, so it has no special privileges.

**Fix**: Either add an RLS policy allowing admin updates (via a `user_roles` table check), or move the admin save logic into an edge function that uses the service role key.

**3. `players.points` Gets Overwritten Per Match**
In `sync-live-scores` line 431: `await supabase.from("players").update({ points, is_playing: true }).eq("id", dbPlayer.id)`. This overwrites the global `players.points` with the **latest match's** points. If a player scores 50 pts in Match 1 then 10 pts in Match 2, their displayed points become 10. The `match_player_points` table correctly isolates per-match, but `players.points` is wrong.

**Fix**: Either remove the `players.points` update entirely (derive from `match_player_points` sum), or compute it as `SUM(points)` across all matches.

**4. Playing XI Never Updates**
`updatePlayingXI()` (line 593) checks `player.external_id` and skips if null. All 11 players in the DB have `external_id = null`. So the Playing XI status will never be set.

**Fix**: The `seed-players` function needs to be run to populate `external_id` values. Alternatively, match Playing XI by name instead of `external_id`.

### Moderate Issues

**5. Fallback ID Mismatch on Live Match View**
When a team is saved, player IDs are remapped from fallback `generateId()` UUIDs to real DB UUIDs. But when loading an existing team during a live match, if `dbPlayers` is empty (API down), `allPlayers` uses fallback IDs from `generateId()`. The `selectedPlayers` filter (`allPlayers.filter(p => selected.has(p.id))`) compares fallback IDs against real DB IDs from `existingTeam.team_players` — they won't match. Result: **"My Team" tab shows 0 players during live matches if the player list API is down.**

**Fix**: Always fetch players from DB for live matches (they were upserted during team save), or maintain a reverse ID map.

**6. Duplicate Unique Indexes**
- `match_players` has two identical unique indexes: `match_players_match_id_player_id_key` AND `match_players_match_player_unique`
- `user_teams` has two identical unique indexes: `user_teams_user_id_match_id_key` AND `user_teams_user_match_unique`

These waste storage and slow writes. **Fix**: Drop the duplicates.

**7. `players.external_id` Has a UNIQUE Constraint but All Values Are NULL**
Multiple null values are allowed (Postgres treats nulls as distinct), so this isn't broken yet. But once `seed-players` runs, if any two players share an `external_id` it will fail. This is fine as long as CricAPI IDs are truly unique.

### Minor Issues

**8. Admin Security is Client-Side Only**
`ADMIN_EMAILS` array is checked in the React component. Any user can call the Supabase API directly to update `match_player_points` (which has a public INSERT/UPDATE policy). The admin page is security theater without server-side enforcement.

**9. Unused Variable in AdminScores**
Line 128: `const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;` is assigned but never used.

**10. Console Warning: Ref on Function Component**
`PlayingXIBadge` and `Badge` components receive refs but aren't wrapped in `forwardRef`. Harmless but noisy.

### Summary of Required Fixes

| Priority | Issue | Fix |
|----------|-------|-----|
| Critical | No `auth.users` trigger for profiles | Create trigger in migration |
| Critical | Admin can't update matches (RLS) | Add edge function for admin ops |
| Critical | `players.points` overwritten each match | Compute as SUM from `match_player_points` |
| Critical | Playing XI never updates (null external_id) | Run seed-players or match by name |
| Moderate | Fallback ID mismatch on live view | Always load players from DB for saved teams |
| Moderate | Duplicate unique indexes | Drop duplicates |
| Minor | Client-side admin security | Move to edge function with role check |
| Minor | Unused variable, console warnings | Clean up |

### Files to Change

| Action | File |
|--------|------|
| Migration | Create `handle_new_user` trigger, drop duplicate indexes |
| Create | `supabase/functions/admin-update-scores/index.ts` — server-side admin logic |
| Edit | `supabase/functions/sync-live-scores/index.ts` — fix `players.points` to use SUM, match Playing XI by name |
| Edit | `src/pages/MatchDetail.tsx` — fix fallback ID mismatch for live view |
| Edit | `src/pages/AdminScores.tsx` — call edge function instead of direct DB update |
| Edit | `src/components/PlayingXIBadge.tsx` — add forwardRef |

