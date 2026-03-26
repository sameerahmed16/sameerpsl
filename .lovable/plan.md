

## Plan: Fix Signup for All Users + Deduplicate Profiles + Unique Username Constraint

### Problems
1. **Google login uses `lovable.auth`** which only works within Lovable's environment — external users on the published site can't use it
2. **Duplicate profiles** exist for the same username ("sameerahmed" appears 3 times, "sameer" once)
3. **No unique constraint on username** — anyone can pick an already-taken username

### Changes

#### 1. Remove Duplicate Profiles (Data cleanup)
- Delete the 3 duplicate profile rows (keep only the one tied to `user_id: 1a5fc270-eac9-42bc-89e3-1cb677b5b06a` which is the active session)
- Use the insert tool (DELETE statement) to remove rows with `user_id` in `(d05428eb-..., 44c07cad-..., 5f6cdbdf-...)`

#### 2. Add Unique Constraint on Username (Migration)
- `ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);`
- This prevents duplicate usernames at the database level

#### 3. Add Username Availability Check on Signup (Auth.tsx)
- Before calling `supabase.auth.signUp`, query `profiles` table to check if the username is already taken
- Show an error toast if username exists
- Add a debounced check that shows inline feedback as the user types

#### 4. Fix Google Login for External Users (Auth.tsx)
- The `lovable.auth.signInWithOAuth('google')` only works inside the Lovable preview environment
- Replace with standard `supabase.auth.signInWithOAuth({ provider: 'google' })` which works for everyone on the published URL
- This requires Google OAuth to be configured in the backend (it already is via Lovable Cloud)

#### 5. Enable Auto-Confirm for Email Signups
- Currently users must verify email before signing in, which can be a barrier
- Use `configure_auth` to enable auto-confirm so users can sign in immediately after signup
- **Note:** Will only do this if available; otherwise keep the current verify-email flow and make sure the messaging is clear

### Files to Edit
- **`src/pages/Auth.tsx`** — Replace `lovable.auth` Google login with `supabase.auth.signInWithOAuth`, add username uniqueness check
- **Migration** — Add unique constraint on `profiles.username`
- **Data cleanup** — Delete duplicate profile rows

### Technical Details
- The `handle_new_user` trigger auto-creates a profile on signup using the username from `raw_user_meta_data`. The unique constraint will cause signup to fail gracefully if username is taken, but we add a pre-check for better UX.
- Google OAuth via `supabase.auth.signInWithOAuth` redirects to Google and back to the app's URL — works on any domain, not just Lovable preview.

