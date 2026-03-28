

## Update future match budget from 85 to 90 credits

Simple one-line change in `src/pages/MatchDetail.tsx`:

**File:** `src/pages/MatchDetail.tsx` (line 35)

Change the budget for future matches from `85` to `90`:
```typescript
return new Date(matchDate) > BUDGET_CUTOFF ? 90 : 100;
```

Also update the memory for team selection rules to reflect the new 90-credit budget.

