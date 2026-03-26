

## Plan: Fix Player Pool to Show Full Squads (26+ Players Per Match)

### Root Cause
Two issues causing incomplete player pools:

1. **Short-circuit on partial DB data** (`MatchDetail.tsx` line 255): `if (dbPlayers.length > 0) return dbPlayers` — when even 1 DB player exists (e.g., 11 from a partial API sync), it skips the fallback entirely. The DB currently has only 33 players total (4-7 per team) instead of the full 17-21 per team in `pslSquads.ts`.

2. **No merge logic**: DB players and fallback players are never combined. If the API sync pulled 11 players for a match, users only see those 11 instead of the full 35+ player pool from both team squads.

### Fix

#### 1. `src/pages/MatchDetail.tsx` — Merge DB + Fallback Players
Replace the short-circuit logic in `allPlayers` useMemo (line 254-260):
- Always load fallback players from `pslSquads.ts` for both teams
- Merge with any DB players: DB players take priority (they have real IDs, updated stats), fallback fills in the rest
- Match by normalized name + team to avoid duplicates
- Result: full squad pool of 26+ players regardless of API sync status

```text
allPlayers flow:
  1. Get fallback players for team_a + team_b from pslSquads.ts
  2. Get DB players from match_players join
  3. Merge: for each fallback player, if a DB player with same name+team exists, use DB version; otherwise use fallback
  4. Add any DB players not in fallback (edge case: API found players not in our static data)
```

#### 2. `src/data/pslSquads.ts` — Already Complete
The static data already has 17-21 players per team for all 8 PSL 2026 teams. Team names in `PSL_SQUADS` keys match `matches.team_a`/`team_b` exactly (confirmed via DB query). No changes needed here.

### Files

| Action | File |
|--------|------|
| Edit | `src/pages/MatchDetail.tsx` — merge fallback + DB players instead of either/or |

### Technical Detail
The merge normalization will lowercase + trim names for comparison. DB players get priority because they have real UUIDs that link correctly to `match_players`, `team_players`, and `match_player_points`. Fallback players use deterministic generated IDs (the existing `generateId` function) which get upserted to real DB IDs on team save.

