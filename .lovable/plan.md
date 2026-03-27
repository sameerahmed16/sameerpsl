

## Plan: Fix Team Save Confirmation & Live Score Updates

### Problem 1: No visible confirmation after saving team
The save shows a brief toast notification, but once it disappears there's no persistent indicator that the team is already saved. Users can't tell if their team was saved.

**Fix**: On the upcoming match team selection view, when `existingTeam` exists, show a persistent "Team Saved ✓" banner above the save button. Change the save button text to "Update Team" when editing an existing team.

**File**: `src/pages/MatchDetail.tsx`
- Add a green confirmation banner when `existingTeam` is truthy and match is upcoming
- Change save button label from "Save Team" to "Update Team" when editing

---

### Problem 2: Live scores not updating — no valid external IDs
The live match (Quetta Gladiators vs Karachi Kings) has `external_id = '81ea634d-...'` which is a self-generated UUID, not a real CricAPI match ID. Both `cricbuzz_match_id` and `espn_match_id` are NULL. The sync function tries to fetch from CricAPI using this fake ID, gets "Failed to fetch after 3 attempts", and gives up.

**Fix**: Add an auto-discovery step at the top of `sync-live-scores` that:
1. For any live match missing valid CricAPI/Cricbuzz/ESPN IDs, queries the CricAPI `currentMatches` endpoint
2. Fuzzy-matches by team names to find the real CricAPI match ID
3. Updates the match record with the real `external_id` (and optionally `cricbuzz_match_id`)
4. Then proceeds with the normal score fetch

This is a ~30-line addition to `sync-live-scores/index.ts`, inserted right after the auto-transition block and before the live matches query.

**File**: `supabase/functions/sync-live-scores/index.ts`

---

### Summary

| Action | File | What |
|--------|------|------|
| Edit | `src/pages/MatchDetail.tsx` | Add persistent "Team Saved" banner + "Update Team" button label |
| Edit | `supabase/functions/sync-live-scores/index.ts` | Auto-discover real CricAPI match IDs for live matches |

