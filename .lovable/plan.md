
Goal: fix the wrong logos, stop the endless “Loading players…” state, and make player data appear even when the live cricket API is unreachable from backend functions.

1. Fix the player loading state in `MatchDetail.tsx`
- Replace the current `autoSyncDone` loading condition with explicit sync state:
  - `isBootstrappingPlayers`
  - `playerSyncFailed`
  - `lastSyncAttempted`
- Make the UI stop showing a spinner once the sync attempt finishes.
- Show one of 3 states clearly:
  - loading
  - players loaded
  - unavailable right now
- This removes the current stuck state caused by `allPlayers.length === 0` combined with a failed background sync.

2. Stop depending on the broken backend path for initial squad loading
- Keep existing backend sync for scheduled/background updates.
- Add a frontend fallback data source for PSL squads so the app can render players even if the external API is unreachable.
- Seed/display squad data by team for known PSL teams, including:
  - player name
  - team
  - role
  - image fallback strategy
  - credits default
- On match page load:
  - try database players first
  - if none exist, use fallback squad data immediately so users can build a team
- This solves the current real issue: database has `0` players and `0` match_players.

3. Correct logo handling
- Replace the current hardcoded external logo URLs in `TeamLogo.tsx` with reliable local/static assets or a strict internal team map.
- Do not use random-looking remote URLs.
- Use a single canonical mapping per team:
  - Lahore Qalandars
  - Karachi Kings
  - Islamabad United
  - Peshawar Zalmi
  - Quetta Gladiators
  - Multan Sultans
  - Hyderabad Kingsmen
  - Rawalpindi Pindiz
- Render the actual team name under the logo instead of `team_a_logo` / `team_b