

## Plan: Fix Cricbuzz Scorecard Parsing — Full Player & Fielding Stats

### Problem
The `tryCricbuzz` function only extracts data from the **miniscore** (current striker, non-striker, current bowlers, last wicket) — that's why logs show "5 players." Dismissed batsmen (like Salman Agha), bowlers who finished their spell, and all fielding stats (catches, run outs, stumpings) are missing.

### Solution
Fetch the Cricbuzz **scorecard page** (`/live-cricket-scorecard/{id}`) in addition to the live scores page, and parse the full RSC payload which contains all batsmen, bowlers, and dismissal descriptions.

### Changes to `supabase/functions/sync-live-scores/index.ts`

**1. Add scorecard page fetch inside `tryCricbuzz`**
After extracting scores from the live page, also fetch:
```
https://www.cricbuzz.com/live-cricket-scorecard/{cricbuzzId}
```
via `supabase.rpc("http_get_text", ...)` — same proxy pattern already in use.

**2. Parse full batting from RSC payload**
Extract all batsmen using the `batName`/`runs`/`balls`/`fours`/`sixes`/`outDesc` patterns already defined in `parseCricbuzzRSC` (lines 425-443). Apply these regexes to the scorecard page HTML to get ALL batsmen including dismissed ones like Salman Agha.

**3. Parse full bowling from RSC payload**
Same approach — `bowlName`/`overs`/`maidens`/`runs`/`wickets` patterns from lines 446-458 applied to scorecard HTML to get all bowlers.

**4. Extract fielding stats from dismissal descriptions**
Parse `outDesc` fields from the scorecard RSC data to credit fielders:
- `"c PlayerName b ..."` → +1 catch for PlayerName
- `"run out (PlayerName)"` or `"run out (PlayerName/...)"` → +1 run out for PlayerName
- `"st PlayerName b ..."` → +1 stumping for PlayerName

This is the only way to get fielding data from Cricbuzz since they don't have a separate fielding stats section.

**5. Replace miniscore-only players with full scorecard players**
If the scorecard page returns more players than the miniscore, use the scorecard data. Keep miniscore as fallback for when scorecard page isn't available yet (very early in match).

### Files

| Action | File | What |
|--------|------|------|
| Edit | `supabase/functions/sync-live-scores/index.ts` | Add scorecard page fetch, full batting/bowling/fielding extraction |

### Technical Notes
- The scorecard page uses the same RSC format as the live scores page — same regex patterns work
- Fielding credits are extracted from dismissal text, which is standard cricket notation
- `mergePlayer` already handles deduplication — safe to merge scorecard data on top of miniscore data
- No database changes needed
- After deploying, the next cron tick will pick up all players and fielding stats

