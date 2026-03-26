-- Drop the restrictive SELECT policy on team_players
DROP POLICY IF EXISTS "Users can view own team players" ON public.team_players;

-- Add a new SELECT policy allowing all authenticated users to view team_players
CREATE POLICY "Anyone can view team players"
ON public.team_players
FOR SELECT
TO authenticated
USING (true);