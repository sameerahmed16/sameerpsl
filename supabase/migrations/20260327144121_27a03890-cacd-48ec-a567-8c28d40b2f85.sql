CREATE OR REPLACE FUNCTION public.http_get_text(target_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  resp record;
BEGIN
  SELECT * INTO resp FROM extensions.http_get(target_url);
  IF resp.status >= 200 AND resp.status < 300 THEN
    RETURN resp.content;
  END IF;
  RAISE EXCEPTION 'HTTP request failed [%]: %', resp.status, left(COALESCE(resp.content, 'No body'), 200);
END;
$$;