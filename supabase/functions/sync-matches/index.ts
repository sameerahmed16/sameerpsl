import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

type CricApiResponse<T = unknown> = {
  status?: string;
  info?: string;
  reason?: string;
  data?: T;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("sync-matches version: db-http-v2");

  try {
    const CRICAPI_KEY = Deno.env.get("CRICAPI_KEY");
    if (!CRICAPI_KEY) throw new Error("CRICAPI_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const currentMatches = await fetchViaDb<CricApiResponse<any[]>>(
      supabase,
      `${CRICAPI_BASE}/currentMatches?apikey=${encodeURIComponent(CRICAPI_KEY)}&offset=0`
    );

    if (currentMatches.status !== "success") {
      throw new Error(`CricAPI error: ${currentMatches.info || currentMatches.reason || "Unknown error"}`);
    }

    const pslMatches = (currentMatches.data || []).filter(
      (m: any) =>
        m?.name?.toLowerCase().includes("psl") ||
        m?.name?.toLowerCase().includes("pakistan super league") ||
        m?.series_id?.toLowerCase?.().includes("psl")
    );

    let pslSeriesId: string | null = null;
    let seriesMatches: any[] = [];

    try {
      const seriesData = await fetchViaDb<CricApiResponse<any[]>>(
        supabase,
        `${CRICAPI_BASE}/series?apikey=${encodeURIComponent(CRICAPI_KEY)}&offset=0`
      );

      if (seriesData.status === "success") {
        const pslSeries = (seriesData.data || []).find(
          (s: any) =>
            s?.info?.toLowerCase().includes("psl") ||
            s?.info?.toLowerCase().includes("pakistan super league")
        );

        if (pslSeries?.id) {
          pslSeriesId = pslSeries.id;
          const seriesInfo = await fetchViaDb<CricApiResponse<{ matchList?: any[] }>>(
            supabase,
            `${CRICAPI_BASE}/series_info?apikey=${encodeURIComponent(CRICAPI_KEY)}&id=${encodeURIComponent(pslSeriesId)}`
          );

          if (seriesInfo.status === "success") {
            seriesMatches = seriesInfo.data?.matchList || [];
          }
        }
      }
    } catch (error) {
      console.error("Series lookup failed, continuing with current matches only:", error);
    }

    const allMatches = [...pslMatches];
    for (const match of seriesMatches) {
      if (match?.id && !allMatches.find((m: any) => m.id === match.id)) {
        allMatches.push(match);
      }
    }

    let matchesSynced = 0;

    for (const match of allMatches) {
      const externalId = match?.id;
      if (!externalId) continue;

      const teams = (match.teams || []) as string[];
      const teamA = teams[0] || match.teamInfo?.[0]?.name || "TBD";
      const teamB = teams[1] || match.teamInfo?.[1]?.name || "TBD";
      const teamALogo =
        match.teamInfo?.[0]?.shortname ||
        teamA.split(" ").map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
      const teamBLogo =
        match.teamInfo?.[1]?.shortname ||
        teamB.split(" ").map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();

      let status = "upcoming";
      if (match.matchStarted && !match.matchEnded) status = "live";
      else if (match.matchEnded) status = "completed";
      else if (match.status?.toLowerCase().includes("won") || match.status?.toLowerCase().includes("drawn")) status = "completed";

      const scores = match.score || [];
      let teamAScore: string | null = null;
      let teamBScore: string | null = null;

      for (const score of scores) {
        const innings = `${score.r || 0}/${score.w || 0} (${score.o || 0})`;
        if (score.inning?.includes(teamA) || score.inning?.includes(teamALogo)) {
          teamAScore = teamAScore ? `${teamAScore} & ${innings}` : innings;
        } else {
          teamBScore = teamBScore ? `${teamBScore} & ${innings}` : innings;
        }
      }

      const matchDate = match.dateTimeGMT || match.date || new Date().toISOString();
      const { data: existing } = await supabase.from("matches").select("id").eq("external_id", externalId).maybeSingle();

      let matchDbId: string;
      if (existing) {
        await supabase
          .from("matches")
          .update({
            team_a: teamA,
            team_b: teamB,
            team_a_logo: teamALogo,
            team_b_logo: teamBLogo,
            match_date: matchDate,
            venue: match.venue || "TBD",
            status,
            team_a_score: teamAScore,
            team_b_score: teamBScore,
          })
          .eq("id", existing.id);
        matchDbId = existing.id;
      } else {
        const { data: newMatch, error } = await supabase
          .from("matches")
          .insert({
            external_id: externalId,
            team_a: teamA,
            team_b: teamB,
            team_a_logo: teamALogo,
            team_b_logo: teamBLogo,
            match_date: matchDate,
            venue: match.venue || "TBD",
            status,
            team_a_score: teamAScore,
            team_b_score: teamBScore,
          })
          .select("id")
          .single();

        if (error || !newMatch) continue;
        matchDbId = newMatch.id;
      }

      matchesSynced++;

      try {
        const squadData = await fetchViaDb<CricApiResponse<any[]>>(
          supabase,
          `${CRICAPI_BASE}/match_squad?apikey=${encodeURIComponent(CRICAPI_KEY)}&id=${encodeURIComponent(externalId)}`
        );

        if (squadData.status === "success" && squadData.data) {
          for (const teamSquad of squadData.data) {
            const teamName = teamSquad.teamName || "Unknown";
            for (const player of teamSquad.players || []) {
              const playerExternalId = player.id;
              if (!playerExternalId) continue;

              const role = mapRole(player.battingStyle, player.bowlingStyle, player.role);
              const { data: existingPlayer } = await supabase
                .from("players")
                .select("id")
                .eq("external_id", playerExternalId)
                .maybeSingle();

              let playerDbId: string;
              if (existingPlayer) {
                await supabase
                  .from("players")
                  .update({
                    name: player.name || "Unknown",
                    team: teamName,
                    role,
                    image_url: player.playerImg || null,
                    is_playing: player.playingXI === true ? true : player.playingXI === false ? false : null,
                  })
                  .eq("id", existingPlayer.id);
                playerDbId = existingPlayer.id;
              } else {
                const { data: newPlayer, error } = await supabase
                  .from("players")
                  .insert({
                    external_id: playerExternalId,
                    name: player.name || "Unknown",
                    team: teamName,
                    role,
                    credits: estimateCredits(player),
                    image_url: player.playerImg || null,
                    is_playing: player.playingXI === true ? true : player.playingXI === false ? false : null,
                  })
                  .select("id")
                  .single();

                if (error || !newPlayer) continue;
                playerDbId = newPlayer.id;
              }

              await supabase
                .from("match_players")
                .upsert({ match_id: matchDbId, player_id: playerDbId }, { onConflict: "match_id,player_id" });
            }
          }
        }
      } catch (error) {
        console.error(`Squad fetch failed for match ${externalId}:`, error);
      }
    }

    return new Response(JSON.stringify({ success: true, matches_synced: matchesSynced, psl_series_id: pslSeriesId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchViaDb<T>(supabase: ReturnType<typeof createClient>, url: string): Promise<T> {
  const { data, error } = await supabase.rpc("http_get_json", { target_url: url });
  if (error) {
    throw new Error(`Database HTTP fetch failed: ${error.message}`);
  }
  return data as T;
}

function mapRole(battingStyle?: string, bowlingStyle?: string, role?: string): "BAT" | "BOWL" | "AR" | "WK" {
  const normalizedRole = (role || "").toLowerCase();
  if (normalizedRole.includes("keeper") || normalizedRole.includes("wk")) return "WK";
  if (normalizedRole.includes("all") || normalizedRole.includes("ar")) return "AR";
  if (normalizedRole.includes("bowl")) return "BOWL";
  if (normalizedRole.includes("bat")) return "BAT";
  if (battingStyle && bowlingStyle && !bowlingStyle.toLowerCase().includes("none")) return "AR";
  if (bowlingStyle && !bowlingStyle.toLowerCase().includes("none")) return "BOWL";
  return "BAT";
}

function estimateCredits(player: any): number {
  const role = (player.role || "").toLowerCase();
  if (role.includes("captain")) return 10;
  if (role.includes("keeper")) return 8.5;
  if (role.includes("all")) return 8;
  return 7.5;
}
