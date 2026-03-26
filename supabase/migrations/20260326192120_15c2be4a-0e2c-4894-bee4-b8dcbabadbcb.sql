
-- Add external_id columns to map CricAPI IDs
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- Add unique constraint on match_players for upsert
ALTER TABLE public.match_players ADD CONSTRAINT match_players_match_player_unique UNIQUE (match_id, player_id);

-- Enable realtime for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Add RLS policy for match_players insert (needed by edge function with service role, but good to have)
-- The service role bypasses RLS, so this is mainly for documentation
