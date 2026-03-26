

## Plan: Per-Match Leaderboard for Upcoming Matches + View Others' Squads

### Problem
1. The "Per Match" tab filters matches to `status IN ('live', 'completed')` — upcoming matches are excluded entirely.
2. `team_players` has an RLS policy that only lets users see their own team players — so viewing another user's squad is impossible.
3. There's no UI to expand a leaderboard entry and see the squad behind it.

### Changes

#### 1. Database Migration
- Add a new SELECT policy on `team_players`: `"Anyone can view team players" FOR SELECT TO authenticated USING (true)` — this enables viewing other users' squads on the leaderboard.
- Drop the existing restrictive SELECT policy on `team_players`.

#### 2. Leaderboard.tsx — Include Upcoming Matches
- Change the matches query from `.in('status', ['live', 'completed'])` to `.in('status', ['upcoming', 'live', 'completed'])` so all matches with entries appear.
- Add a status badge next to each match button (e.g., "Upcoming", "Live", "Completed").
- For upcoming matches, show "Entries: X" instead of points since points are 0.

#### 3. Leaderboard.tsx — Expandable Squad View
- Make each leaderboard entry clickable/expandable.
- On click, fetch `team_players` joined with `players` for that user's `user_team_id`.
- Show the 11 players in a compact grid with name, role, C/VC badges.
- For live/completed matches, show each player's match points from `match_player_points`.

### Files

| Action | File |
|--------|------|
| Migration | Add public SELECT policy on `team_players`, drop restrictive one |
| Edit | `src/pages/Leaderboard.tsx` — include upcoming matches, add expandable squad view |

### Technical Details
- Match entries query for upcoming: still queries `user_teams` by `match_id`, ordered by `created_at` (since all have 0 points).
- Squad fetch: `supabase.from('team_players').select('player_id, players(name, role, team, credits)').eq('user_team_id', teamId)` — also fetch `user_teams.captain_id` and `vice_captain_id` to display C/VC badges.
- The expanded view uses an accordion-style pattern — clicking an entry toggles the squad panel below it.

