import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      // If rate limited, wait longer
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, delayMs * (i + 2)));
        continue;
      }
      return res;
    } catch (err) {
      console.error(`Fetch attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error("All retry attempts exhausted");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CRICAPI_KEY = Deno.env.get("CRICAPI_KEY");
    if (!CRICAPI_KEY) throw new Error("CRICAPI_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Fetch current matches from CricAPI with retry
    const matchesRes = await fetchWithRetry(
      `${CRICAPI_BASE}/currentMatches?apikey=${CRICAPI_KEY}&offset=0`
    );
    if (!matchesRes.ok) {
      throw new Error(`CricAPI currentMatches failed [${matchesRes.status}]: ${await matchesRes.text()}`);
    }
    const matchesData = await matchesRes.json();

    if (matchesData.status !== "success") {
      throw new Error(`CricAPI error: ${matchesData.info || "Unknown error"}`);
    }

    // Filter PSL matches
    const pslMatches = (matchesData.data || []).filter(
      (m: any) =>
        m.name?.toLowerCase().includes("psl") ||
        m.name?.toLowerCase().includes("pakistan super league") ||
        m.series_id?.toLowerCase().includes("psl")
    );

    // Also try series endpoint
    let pslSeriesId: string | null = null;
    try {
      const seriesRes = await fetchWithRetry(
        `${CRICAPI_BASE}/series?apikey=${CRICAPI_KEY}&offset=0`
      );
      if (seriesRes.ok) {
        const seriesData = await seriesRes.json();
        if (seriesData.status === "success") {
          const pslSeries = (seriesData.data || []).find(
            (s: any) =>
              s.info?.toLowerCase().includes("psl") ||
              s.info?.toLowerCase().includes("pakistan super league")
          );
          if (pslSeries) pslSeriesId = pslSeries.id;
        }
      }
    } catch (e) {
      console.error("Series fetch failed, continuing with currentMatches only:", e);
    }

    // Fetch series matches if found
    let seriesMatches: any[] = [];
    if (pslSeriesId) {
      try {
        const seriesInfoRes = await fetchWithRetry(
          `${CRICAPI_BASE}/series_info?apikey=${CRICAPI_KEY}&id=${pslSeriesId}`
        );
        if (seriesInfoRes.ok) {
          const seriesInfoData = await seriesInfoRes.json();
          if (seriesInfoData.status === "success") {
            seriesMatches = seriesInfoData.data?.matchList || [];
          }
        }
      } catch (e) {
        console.error("Series info fetch failed:", e);
      }
    }

    // Combine and deduplicate
    const allMatches = [...pslMatches];
    for (const sm of seriesMatches) {
      if (sm.id && !allMatches.find((m: any) => m.id === sm.id)) {
        allMatches.push(sm);
      }
    }

    let matchesSynced = 0;

    for (const m of allMatches) {
      const externalId = m.id;
      if (!externalId) continue;

      const teams = (m.teams || []) as string[];
      const teamA = teams[0] || m.teamInfo?.[0]?.name || "TBD";
      const teamB = teams[1] || m.teamInfo?.[1]?.name || "TBD";
      const teamALogo =
        m.teamInfo?.[0]?.shortname ||
        teamA.split(" ").map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
      const teamBLogo =
        m.teamInfo?.[1]?.shortname ||
        teamB.split(" ").map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();

      let status = "upcoming";
      if (m.matchStarted && !m.matchEnded) status = "live";
      else if (m.matchEnded) status = "completed";
      else if (m.status?.toLowerCase().includes("won") || m.status?.toLowerCase().includes("drawn"))
        status = "completed";

      const scores = m.score || [];
      let teamAScore: string | null = null;
      let teamBScore: string | null = null;
      for (const s of scores) {
        const innings = `${s.r || 0}/${s.w || 0} (${s.o || 0})`;
        if (s.inning?.includes(teamA) || s.inning?.includes(teamALogo)) {
          teamAScore = teamAScore ? `${teamAScore} & ${innings}` : innings;
        } else {
          teamBScore = teamBScore ? `${teamBScore} & ${innings}` : innings;
        }
      }

      const matchDate = m.dateTimeGMT || m.date || new Date().toISOString();

      const { data: existing } = await supabase
        .from("matches")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();

      let matchDbId: string;

      if (existing) {
        await supabase
          .from("matches")
          .update({
            team_a: teamA, team_b: teamB,
            team_a_logo: teamALogo, team_b_logo: teamBLogo,
            match_date: matchDate, venue: m.venue || "TBD",
            status, team_a_score: teamAScore, team_b_score: teamBScore,
          })
          .eq("id", existing.id);
        matchDbId = existing.id;
      } else {
        const { data: newMatch, error } = await supabase
          .from("matches")
          .insert({
            external_id: externalId,
            team_a: teamA, team_b: teamB,
            team_a_logo: teamALogo, team_b_logo: teamBLogo,
            match_date: matchDate, venue: m.venue || "TBD",
            status, team_a_score: teamAScore, team_b_score: teamBScore,
          })
          .select()
          .single();
        if (error || !newMatch) continue;
        matchDbId = newMatch.id;
      }

      matchesSynced++;

      // Fetch squad (non-critical, skip on failure)
      try {
        const squadRes = await fetchWithRetry(
          `${CRICAPI_BASE}/match_squad?apikey=${CRICAPI_KEY}&id=${externalId}`,
          2, 500
        );
        if (squadRes.ok) {
          const squadData = await squadRes.json();
          if (squadData.status === "success" && squadData.data) {
            for (const teamSquad of squadData.data) {
              const teamName = teamSquad.teamName || "Unknown";
              for (const p of teamSquad.players || []) {
                const pExternalId = p.id;
                if (!pExternalId) continue;
                const role = mapRole(p.battingStyle, p.bowlingStyle, p.role);
                const { data: existingPlayer } = await supabase
                  .from("players").select("id").eq("external_id", pExternalId).maybeSingle();

                let playerDbId: string;
                if (existingPlayer) {
                  await supabase.from("players").update({
                    name: p.name || "Unknown", team: teamName, role,
                    image_url: p.playerImg || null,
                    is_playing: p.playingXI === true ? true : p.playingXI === false ? false : null,
                  }).eq("id", existingPlayer.id);
                  playerDbId = existingPlayer.id;
                } else {
                  const { data: newPlayer, error } = await supabase
                    .from("players").insert({
                      external_id: pExternalId, name: p.name || "Unknown",
                      team: teamName, role, credits: estimateCredits(p),
                      image_url: p.playerImg || null,
                      is_playing: p.playingXI === true ? true : p.playingXI === false ? false : null,
                    }).select().single();
                  if (error || !newPlayer) continue;
                  playerDbId = newPlayer.id;
                }
                await supabase.from("match_players")
                  .upsert({ match_id: matchDbId, player_id: playerDbId }, { onConflict: "match_id,player_id" });
              }
            }
          }
        }
      } catch (squadErr) {
        console.error(`Squad fetch error for match ${externalId}:`, squadErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, matches_synced: matchesSynced, psl_series_id: pslSeriesId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapRole(battingStyle?: string, bowlingStyle?: string, role?: string): "BAT" | "BOWL" | "AR" | "WK" {
  const r = (role || "").toLowerCase();
  if (r.includes("keeper") || r.includes("wk")) return "WK";
  if (r.includes("all") || r.includes("ar")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  if (r.includes("bat")) return "BAT";
  if (battingStyle && bowlingStyle && !bowlingStyle.toLowerCase().includes("none")) return "AR";
  if (bowlingStyle && !bowlingStyle.toLowerCase().includes("none")) return "BOWL";
  return "BAT";
}

function estimateCredits(player: any): number {
  const r = (player.role || "").toLowerCase();
  if (r.includes("captain")) return 10;
  if (r.includes("keeper")) return 8.5;
  if (r.includes("all")) return 8;
  return 7.5;
}
