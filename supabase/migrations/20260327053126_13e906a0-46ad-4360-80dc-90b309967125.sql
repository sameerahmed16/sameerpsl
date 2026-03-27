CREATE TABLE public.player_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  alias text NOT NULL,
  UNIQUE(alias)
);

ALTER TABLE public.player_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aliases viewable by everyone" ON public.player_aliases FOR SELECT USING (true);
CREATE POLICY "Service role manages aliases" ON public.player_aliases FOR ALL TO service_role USING (true) WITH CHECK (true);