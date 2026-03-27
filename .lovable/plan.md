

## Plan: Add Forgot Password Flow

### Changes

#### 1. `src/pages/Auth.tsx` — Add forgot password mode
- Add a third mode state: `'login' | 'signup' | 'forgot'`
- In forgot mode, show only email field + "Send Reset Link" button
- Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Add "Forgot password?" link below the password field on login view
- Add "Back to sign in" link from forgot view

#### 2. `src/pages/ResetPassword.tsx` — New page for setting new password
- Check URL hash for `type=recovery` session
- Show new password + confirm password form
- Call `supabase.auth.updateUser({ password })` on submit
- Redirect to `/` on success
- Public route (not behind ProtectedRoute)

#### 3. `src/App.tsx` — Add route
- Add `/reset-password` route pointing to `ResetPassword` (not wrapped in ProtectedRoute or AuthRoute)

### Files
| Action | File |
|--------|------|
| Edit | `src/pages/Auth.tsx` |
| Create | `src/pages/ResetPassword.tsx` |
| Edit | `src/App.tsx` |

