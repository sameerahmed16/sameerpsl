
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lock_time timestamptz;

UPDATE public.matches SET lock_time = match_date WHERE lock_time IS NULL;

ALTER TABLE public.user_teams ADD CONSTRAINT user_teams_user_match_unique UNIQUE (user_id, match_id);
