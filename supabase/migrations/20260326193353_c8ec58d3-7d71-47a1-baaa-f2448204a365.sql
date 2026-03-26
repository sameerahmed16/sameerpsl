CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.http_get_json(target_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  resp record;
BEGIN
  SELECT * INTO resp FROM extensions.http_get(target_url);

  IF resp.status >= 200 AND resp.status < 300 THEN
    RETURN resp.content::jsonb;
  END IF;

  RAISE EXCEPTION 'HTTP request failed [%]: %', resp.status, COALESCE(resp.content, 'No response body');
END;
$$;