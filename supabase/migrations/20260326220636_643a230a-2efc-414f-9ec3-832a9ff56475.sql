ALTER TABLE public.match_players DROP CONSTRAINT IF EXISTS match_players_match_player_unique;
ALTER TABLE public.user_teams DROP CONSTRAINT IF EXISTS user_teams_user_match_unique;