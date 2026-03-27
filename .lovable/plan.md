

## Plan: Fix Live Score Sync — CricAPI Unreachable from Backend

### Root Cause
CricAPI (`api.cricapi.com`) is unreachable from the backend environment:
- **Direct fetch**: times out from edge functions
- **Database HTTP extension**: SSL handshake fails (`SSL_ERROR_SYSCALL`)
- **Result**: Auto-discovery fails, CricAPI scorecard fetch fails, and Cricbuzz/ESPN fallbacks are skipped because their match IDs are NULL

The http extension works fine for other domains (tested with httpbin.org), so this is specific to CricAPI's SSL/network configuration.

### Fix: Use Free Public Cricket APIs as Primary Source

Replace CricAPI with free, accessible cricket data sources that work from edge functions:

#### 1. Switch to Cricbuzz scraping as primary source (`sync-live-scores/index.ts`)
- Use the Cricbuzz mobile API (`https://www.cricbuzz.com/api/cricket-match/commentary/{id}`) which returns JSON and doesn't require an API key
- Auto-discover Cricbuzz match IDs by scraping `https://www.cricbuzz.com/cricket-match/live-scores` — parse the PSL match links to extract IDs
- Store discovered `cricbuzz_match_id` on the match record
- Keep CricAPI as a secondary fallback (in case their SSL issue is temporary)

#### 2. Rewrite auto-discovery to use Cricbuzz (`sync-live-scores/index.ts`)
- Fetch `https://www.cricbuzz.com/api/matches/live` (returns JSON list of live matches)
- Match by team names to find the Cricbuzz match ID
- Update the match record with the discovered `cricbuzz_match_id`
- This replaces the broken CricAPI `currentMatches` discovery

#### 3. Add ESPN Cricinfo as tertiary source (`sync-live-scores/index.ts`)
- Use `https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current?lang=en` for match discovery
- Use `https://hs-consumer-api.espncricinfo.com/v1/pages/match/scoreboard?lang=en&matchId={id}` for scorecard
- Store discovered `espn_match_id` on the match record

#### 4. Reorder source priority
```text
1. Cricbuzz JSON API (free, no key, JSON response)
2. ESPN Cricinfo API (free, no key, JSON response)  
3. CricAPI (paid, requires key, currently broken SSL)
```

### Files

| Action | File | What |
|--------|------|------|
| Edit | `supabase/functions/sync-live-scores/index.ts` | Rewrite discovery + source priority to use Cricbuzz/ESPN first |

### Technical Notes
- No database changes needed — `cricbuzz_match_id` and `espn_match_id` columns already exist
- No new API keys needed — Cricbuzz and ESPN public endpoints are free
- The cron job frequency stays the same (every minute)
- If Cricbuzz/ESPN also fail from edge functions, we'll add the database http extension as a fetch fallback for those domains too (it works for non-CricAPI domains)

