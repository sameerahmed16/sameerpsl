
Fix the auth flow by simplifying it back to a stable baseline instead of layering more retries on top.

What I found
- The app is rendering the `/auth` page, so this is no longer the original global loader problem.
- Current auth code now has multiple recovery layers: startup timeout, stale-session clearing, client-side profile self-healing, request timeouts, and special-case fetch handling.
- That extra recovery logic likely turned a previously working auth flow into a fragile one.
- There is also duplicated profile creation:
  - database trigger creates profiles on signup
  - `AuthContext` also tries to create profiles on login/session restore
- Console warnings point to route wrapper structure issues too:
  - `Function components cannot be given refs`
  - this is likely caused by passing wrapper components directly inside route `element` trees

Best fix
Restore a clean, conventional auth flow and remove the fragile parts that were added during troubleshooting.

Implementation plan

1. Simplify `AuthContext`
- Remove client-side `ensureProfile()` from session bootstrap
- Remove aggressive stale-session clearing during normal initialization
- Keep only:
  - `onAuthStateChange` listener
  - one `getSession()` call
  - straightforward `loading` handling
- Only clear local auth state on explicit sign-out or clearly invalid session errors

2. Simplify `Auth.tsx`
- Remove the timeout wrapper around auth requests
- Remove the “clear stale session on any fetch/timed out error” behavior
- Return to direct calls for:
  - `signInWithPassword`
  - `signUp`
  - `resetPasswordForEmail`
- Keep user-facing errors simple and accurate

3. Keep signup profile creation server-side only
- Rely on the existing signup trigger to create