

## Add Player Aliases for Ahmad Daniyal and Farhan Yousuf

### Problem
Cricbuzz scorecards use different spellings than what's stored in the database:
- **"Ahmed Daniyal"** on Cricbuzz vs **"Ahmad Daniyal"** in DB (player ID: `bb32a1f9-5967-4fc5-9598-83e5cc2f63b0`)
- **"Farhan Yousaf"** on Cricbuzz vs **"Farhan Yousuf"** in DB (player ID: `07d7844f-361e-4af3-8553-6d2d4ba5ea87`)

This causes the scoring engine to skip these players during scorecard processing, so they have 0 match points.

### Plan

**Step 1 — Insert aliases via database migration**

Add two rows to the `player_aliases` table:
- `alias: "Ahmed Daniyal"` → `player_id: bb32a1f9-...` (Ahmad Daniyal, Quetta)
- `alias: "Farhan Yousaf"` → `player_id: 07d7844f-...` (Farhan Yousuf, Peshawar)

**Step 2 — Trigger recalculation**

After aliases are in place, use the admin panel's "Recalculate from Cricbuzz" button on the affected matches:
- Match 2: Quetta vs Karachi Kings (`6c7bb16f-...`) — Ahmad Daniyal played
- Match 3: Peshawar vs Rawalpindi (`e1b40bf5-...`) — Farhan Yousaf played
- Match 5: Quetta vs Hyderabad (`bf0ef35b-...`) — Ahmad Daniyal played

This will re-scrape the scorecards and now correctly resolve the alias names to the right player IDs, populating their points.

### Files
- One SQL migration to insert the two alias rows
- No code changes needed — the alias resolution system already works

