
Root cause: this is no longer just a frontend loading-state issue. The code already has timeout handling and stale-session cleanup in `src/contexts/AuthContext.tsx` and `src/pages/Auth.tsx`, but the actual auth requests are failing before login can complete.

What I found:
- The app is currently on `/auth`, and the login UI is rendering.
- Console logs show `TypeError: Failed to fetch` coming directly from `supabase.auth.signInWithPassword(...)`.
- Network logs show both of these requests failing at the network layer:
  - refresh token request: `POST /auth/v1/token?grant_type=refresh_token`
  - password login request: `POST /auth/v1/token?grant_type=password`
- Session replay confirms the form is not frozen anymore: it now shows the toast `Connection failed. Stale session cleared — please try again.` after each attempt.

That means:
- the “stuck on loading” symptom you feel is really “login can never complete”
- the existing UI/auth-state fixes are working as designed
- the real regression is backend auth connectivity/availability

Most likely cause:
- the project’s backend auth endpoint is currently unhealthy or intermittently unreachable
- this matches the other backend metadata failures already present in the project context (`connection timeout`, internal backend errors)
- because even a fresh password login fails with `Failed to fetch`, this is not just caused by an old local session

Plan to fix it:
1. Verify backend auth health first
- Check auth/backend logs and project health from the backend side
- Confirm whether auth is timing out, refusing connections, or failing before request handling

2. Stabilize the client for partial outages
- Keep the current timeout/session cleanup logic
- Add a clearer full-page auth error state on `/auth` when the backend is unreachable, instead of making it feel like the app is broken silently
- Show a specific retry action and connectivity message

3. Remove fragile duplicate profile creation behavior
- The database already has an automatic signup trigger `handle_new_user()` that creates profiles
- `AuthContext` also tries to create a profile manually on login/session restore
- I would remove or limit the manual insert path so auth recovery does not do unnecessary extra database work during sign-in/session bootstrap

4. Audit auth route behavior
- Update `AuthRoute` so it does not render `null` while loading for too long
- Replace blank/ambiguous states with a deterministic “checking session / backend unavailable” state

5. If backend health is the confirmed culprit, repair the backend dependency path
- Inspect recent backend/auth configuration and any changes around the time the app “used to work”
- Check whether the auth service or project backend is timing out broadly, since metadata queries are also failing in this project
- Once backend availability is restored, login should resume without needing users to clear storage manually

Files likely involved:
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth.tsx`
- `src/App.tsx`

Technical notes:
- `onAuthStateChange` is already non-blocking enough; it is not the primary remaining blocker.
- The stronger evidence is that both refresh and password auth calls fail with `Failed to fetch`, which points to unreachable auth infrastructure rather than a React deadlock.
- There is also duplicated profile creation logic:
  - DB trigger in `supabase/migrations/20260326190204_f422d0bc-3f18-4a87-8652-253b87a501bb.sql`
  - client-side `ensureProfile()` in `src/contexts/AuthContext.tsx`
  This should be simplified, but it is secondary to the auth connectivity failure.

Expected result after the fix:
- the app will either log in normally again, or show a clear backend-unavailable state instead of trapping users on the login page
- sign-in will not appear broken or indefinite
- profile creation will be more reliable and less coupled to session bootstrap
