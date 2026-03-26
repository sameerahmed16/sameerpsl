
-- Drop existing restrictive SELECT policy on user_teams
DROP POLICY IF EXISTS "Users can view own teams" ON public.user_teams;

-- Add policy allowing all authenticated users to view all teams (for leaderboard)
CREATE POLICY "Anyone can view teams for leaderboard" ON public.user_teams
FOR SELECT TO authenticated USING (true);
