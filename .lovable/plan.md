

## Plan: Multi-Source Live Score Fallback Chain

### Current State
- CricAPI is the sole data source, often blocked by network resets in Edge Functions
- `http_get_json` RPC is the only fallback, also unreliable
- If both fail, no scores update at all

### What We'll Build

A priority-based fallback chain in `sync-live-scores`: **CricAPI → Cricbuzz scraping → ESPN scraping → manual entry admin panel**

#### 1. Cricbuzz Scraping Fallback (Edge Function)
When CricAPI fails, scrape Cricbuzz's live scorecard page for the match. Cricbuzz URLs follow a predictable pattern (`/live-cricket-scores/{match_id}`).

- Store `cricbuzz_match_id` on the `matches` table (new column via migration)
- Parse the HTML for: team scores, individual batting/bowling stats, match status
- Extract player names and stats, map to DB players by fuzzy name matching
- Compute fantasy points from scraped stats using the same scoring functions

#### 2. ESPN Scraping Fallback
If Cricbuzz also fails, try ESPN Cricinfo's JSON API (they expose match data at predictable endpoints like `https://www.espncricinfo.com/matches/engine/match/{id}.json`).

- Store `espn_match_id` on the `matches` table
- ESPN's JSON endpoint returns structured scorecard data — easier to parse than HTML

#### 3. Admin Manual Score Entry
As the last resort, add an admin page where you can manually enter:
- Match scores (team runs/wickets/overs)
- Individual player batting/bowling stats
- Match status (live/completed)

This writes directly to `match_player_points` and `matches` tables.

#### 4. Fallback Orchestration in Edge Function
Update `sync-live-scores` with a waterfall:
```text
trySource("cricapi")  → success? done
trySource("cricbuzz") → success? done  
trySource("espn")     → success? done
log("All sources failed, awaiting manual entry")
```

Each source returns a normalized `MatchScoreData` object with the same shape, so downstream point calculation is source-agnostic.

### Database Migration
- Add `cricbuzz_match_id` and `espn_match_id` columns to `matches`
- Add `data_source` column to `match_player_points` (track where points came from)

### Files Summary

| Action | File |
|--------|------|
| Edit | `supabase/functions/sync-live-scores/index.ts` — add Cricbuzz + ESPN scrapers, fallback chain |
| Migration | Add `cricbuzz_match_id`, `espn_match_id` to `matches`; `data_source` to `match_player_points` |
| Create | `src/pages/AdminScores.tsx` — manual score entry page |
| Edit | `src/App.tsx` — add admin route |

### Technical Details

- **Cricbuzz scraping**: Direct `fetch()` of the match page HTML, parse with regex/string matching for score blocks. No Firecrawl needed — Cricbuzz pages are static HTML.
- **ESPN JSON**: Their match pages expose a `.json` endpoint with full scorecard data including player IDs and stats.
- **Name matching**: Normalize player names (lowercase, remove diacritics) and match against DB players by team + fuzzy name. Handle common variations (e.g., "Babar Azam" vs "M Babar Azam").
- **Admin auth**: Only allow manual entry for users with admin role (check `user_roles` table). If no admin role system exists yet, use a simple email whitelist.
- **Data source tracking**: `match_player_points.data_source` = 'cricapi' | 'cricbuzz' | 'espn' | 'manual' for debugging which source was used.

