

## Plan: Add Edit Profile with Change Username

### Overview
Add an "Edit Profile" button to the Profile page that opens a dialog where users can update their display name (username).

### Changes

**1. Update `src/pages/Profile.tsx`**
- Add an "Edit Profile" button (pencil icon) next to the username
- Add a Dialog with an input field for editing the username
- On save, update the `profiles` table via Supabase and invalidate the query cache
- Show a toast on success/error

### Technical details
- Uses existing `profiles` table which already has an RLS policy allowing `UPDATE` for own profile (`auth.uid() = user_id`)
- No database migration needed -- the `username` column already exists and is updatable
- Uses existing Dialog, Input, Button, and toast components
- Uses `useQueryClient().invalidateQueries` to refresh profile data after update

