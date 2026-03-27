
## Plan: Fix the live domain showing the placeholder instead of your app

### What I found
- Your project is marked **published** and **public**.
- `src/App.tsx` clearly contains the real app with routes for auth, leaderboard, match detail, profile, etc.
- But both live URLs currently return the default placeholder:
  - `https://sameerpsl.lovable.app`
  - `https://pslfantasyleague.live`

So this does **not** look like a React/runtime bug. It looks like the live site is still pointing at an old placeholder deployment or the domain mapping is attached to the wrong published build.

### Plan
1. **Verify publish target vs live output**
   - Confirm the live published deployment is not serving the current frontend bundle.
   - Treat this as a deployment/domain issue, not an app code issue.

2. **Check the project’s domain connection**
   - Review the domain settings for:
     - `sameerpsl.lovable.app`
     - `pslfantasyleague.live`
   - Confirm the custom domain is attached to this exact project and not an older/placeholder deployment.

3. **Force-refresh the live deployment**
   - Re-publish the frontend so the current app bundle replaces the placeholder build.
   - If Lovable still says “up to date,” the recovery path is to republish/reconnect rather than edit code.

4. **Re-test both domains**
   - Verify that both the Lovable subdomain and the custom domain show the actual app instead of the placeholder.

5. **Fallback if it still shows placeholder**
   - Remove and reconnect the custom domain if only the custom domain is wrong.
   - If **both** domains still show the placeholder after republishing, escalate as a platform publishing issue because the project code and publish visibility are already correct.

### Expected result
```text
Current:
Preview -> real app
Published subdomain -> placeholder
Custom domain -> placeholder

After fix:
Preview -> real app
Published subdomain -> real app
Custom domain -> real app
```

### No code changes expected
- I do not currently expect any file edits.
- The issue appears to be in live publishing/domain linkage, not in the app source.

### Likely user-facing fix path
- Open **Publish**
- Try **Update** again
- If unchanged, open **Settings → Domains**
- Verify `pslfantasyleague.live` is connected to this project
- If needed, disconnect/reconnect the domain and republish

### Important note
Because the **Lovable subdomain itself** is also showing the placeholder, the primary issue is likely the live frontend deployment state, with the custom domain inheriting that same bad target.
