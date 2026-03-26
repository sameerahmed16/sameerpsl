
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_logo TEXT NOT NULL,
  team_b_logo TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  team_a_score TEXT,
  team_b_score TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches viewable by everyone" ON public.matches FOR SELECT USING (true);

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Players table
CREATE TYPE public.player_role AS ENUM ('BAT', 'BOWL', 'AR', 'WK');

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  role player_role NOT NULL,
  credits NUMERIC(4,1) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  is_playing BOOLEAN,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players viewable by everyone" ON public.players FOR SELECT USING (true);

-- User fantasy teams
CREATE TABLE public.user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  captain_id UUID NOT NULL REFERENCES public.players(id),
  vice_captain_id UUID NOT NULL REFERENCES public.players(id),
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own teams" ON public.user_teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own teams" ON public.user_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teams" ON public.user_teams FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_teams_updated_at BEFORE UPDATE ON public.user_teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Team players junction
CREATE TABLE public.team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_team_id UUID NOT NULL REFERENCES public.user_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id),
  UNIQUE(user_team_id, player_id)
);

ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own team players" ON public.team_players FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_teams ut WHERE ut.id = user_team_id AND ut.user_id = auth.uid()));
CREATE POLICY "Users can insert own team players" ON public.team_players FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_teams ut WHERE ut.id = user_team_id AND ut.user_id = auth.uid()));

-- Leagues
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prize TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues viewable by everyone" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = created_by);

-- League members
CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League members viewable by everyone" ON public.league_members FOR SELECT USING (true);
CREATE POLICY "Users can join leagues" ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave leagues" ON public.league_members FOR DELETE USING (auth.uid() = user_id);

-- Match-player junction
CREATE TABLE public.match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match players viewable by everyone" ON public.match_players FOR SELECT USING (true);
