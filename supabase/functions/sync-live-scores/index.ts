import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

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

    const { data: liveMatches } = await supabase
      .from("matches")
      .select("id, external_id, team_a, team_b, team_a_logo, team_b_logo, status")
      .in("status", ["live"]);

    if (!liveMatches?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No live matches to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;

    for (const match of liveMatches) {
      const extId = match.external_id;
      if (!extId) continue;

      try {
        // 1. Fetch match info for scores
        const data = await apiFetch(
          `${CRICAPI_BASE}/match_info?apikey=${encodeURIComponent(CRICAPI_KEY)}&id=${extId}`,
          supabase
        );
        if (data.status !== "success" || !data.data) continue;

        const m = data.data;
        const scores = m.score || [];
        let teamAScore: string | null = null;
        let teamBScore: string | null = null;

        for (const s of scores) {
          const innings = `${s.r || 0}/${s.w || 0} (${s.o || 0})`;
          if (s.inning?.includes(match.team_a) || s.inning?.includes(match.team_a_logo)) {
            teamAScore = teamAScore ? `${teamAScore} & ${innings}` : innings;
          } else {
            teamBScore = teamBScore ? `${teamBScore} & ${innings}` : innings;
          }
        }

        let status = "live";
        if (m.matchEnded) status = "completed";

        await supabase
          .from("matches")
          .update({ team_a_score: teamAScore, team_b_score: teamBScore, status })
          .eq("id", match.id);

        // 2. Update Playing XI
        await updatePlayingXI(supabase, CRICAPI_KEY, extId, match.id);

        // 3. Update player stats — compute from scratch into match_player_points
        await updatePlayerStats(supabase, CRICAPI_KEY, extId, match.id);

        // 4. Recalculate user team points for this match
        await recalcUserTeamPoints(supabase, match.id);

        updated++;
      } catch (matchErr) {
        console.error(`Error updating match ${match.id}:`, matchErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Live sync error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Points Recalculation ───────────────────────────────────────────────────

async function recalcUserTeamPoints(
  supabase: ReturnType<typeof createClient>,
  matchId: string
) {
  try {
    const { data: userTeams } = await supabase
      .from("user_teams")
      .select("id, captain_id, vice_captain_id, user_id")
      .eq("match_id", matchId);

    if (!userTeams?.length) return;

    for (const ut of userTeams) {
      // Get team players with their match-specific points
      const { data: teamPlayers } = await supabase
        .from("team_players")
        .select("player_id")
        .eq("user_team_id", ut.id);

      if (!teamPlayers?.length) continue;

      const playerIds = teamPlayers.map(tp => tp.player_id);

      // Get match-specific points from match_player_points
      const { data: matchPoints } = await supabase
        .from("match_player_points")
        .select("player_id, points")
        .eq("match_id", matchId)
        .in("player_id", playerIds);

      const pointsMap = new Map((matchPoints || []).map(mp => [mp.player_id, mp.points]));

      let total = 0;
      for (const tp of teamPlayers) {
        const pts = pointsMap.get(tp.player_id) || 0;
        if (tp.player_id === ut.captain_id) {
          total += pts * 2;
        } else if (tp.player_id === ut.vice_captain_id) {
          total += pts * 1.5;
        } else {
          total += pts;
        }
      }

      await supabase
        .from("user_teams")
        .update({ total_points: Math.round(total) })
        .eq("id", ut.id);
    }

    // Update profiles total_points (sum of all user_teams)
    const userIds = [...new Set(userTeams.map(ut => ut.user_id))];
    for (const userId of userIds) {
      const { data: allTeams } = await supabase
        .from("user_teams")
        .select("total_points")
        .eq("user_id", userId);

      const totalProfile = (allTeams || []).reduce((s, t) => s + (t.total_points || 0), 0);
      await supabase
        .from("profiles")
        .update({ total_points: totalProfile })
        .eq("user_id", userId);
    }
  } catch (err) {
    console.error("Error recalculating user team points:", err);
  }
}

// ─── Playing XI ─────────────────────────────────────────────────────────────

async function updatePlayingXI(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  externalMatchId: string,
  matchId: string
) {
  try {
    const data = await apiFetch(
      `${CRICAPI_BASE}/match_squad?apikey=${encodeURIComponent(apiKey)}&id=${externalMatchId}`,
      supabase
    );
    if (data.status !== "success" || !data.data) return;

    const { data: matchPlayers } = await supabase
      .from("match_players")
      .select("player_id, players(id, external_id)")
      .eq("match_id", matchId);

    if (!matchPlayers?.length) return;

    const playingXIIds = new Set<string>();
    for (const squad of data.data) {
      for (const player of squad.players || []) {
        if (player.id && player.playing11 !== false) {
          playingXIIds.add(player.id);
        }
      }
    }

    for (const mp of matchPlayers) {
      const player = mp.players as any;
      if (!player?.external_id) continue;
      const isPlaying = playingXIIds.has(player.external_id);
      await supabase.from("players").update({ is_playing: isPlaying }).eq("id", player.id);
    }
  } catch (err) {
    console.error("Error updating Playing XI:", err);
  }
}

// ─── Player Stats — Compute from Scratch ────────────────────────────────────

async function updatePlayerStats(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  externalMatchId: string,
  matchId: string
) {
  try {
    const scData = await apiFetch(
      `${CRICAPI_BASE}/match_scorecard?apikey=${encodeURIComponent(apiKey)}&id=${externalMatchId}`,
      supabase
    );
    if (scData.status !== "success" || !scData.data?.scorecard) return;

    // Accumulate all points per player from scratch
    const pointsMap = new Map<string, number>(); // external_id -> points

    for (const innings of scData.data.scorecard) {
      // Batting
      for (const bat of innings.batting || []) {
        if (!bat.batsman?.id) continue;
        const extId = bat.batsman.id;
        const pts = calculateBattingPoints(bat);
        pointsMap.set(extId, (pointsMap.get(extId) || 0) + pts);
      }

      // Bowling
      for (const bowl of innings.bowling || []) {
        if (!bowl.bowler?.id) continue;
        const extId = bowl.bowler.id;
        const pts = calculateBowlingPoints(bowl);
        pointsMap.set(extId, (pointsMap.get(extId) || 0) + pts);
      }

      // Fielding
      for (const field of innings.catching || []) {
        if (!field.catcher?.id) continue;
        const extId = field.catcher.id;
        const pts = (field.catches || 0) * 8 + (field.runOut || 0) * 12 + (field.stumpiing || 0) * 12;
        if (pts > 0) {
          pointsMap.set(extId, (pointsMap.get(extId) || 0) + pts);
        }
      }
    }

    // Now upsert into match_player_points using external_id → player_id mapping
    for (const [externalId, points] of pointsMap) {
      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();

      if (!player) continue;

      // Upsert into match_player_points (from scratch each time)
      await supabase.from("match_player_points").upsert(
        { match_id: matchId, player_id: player.id, points },
        { onConflict: "match_id,player_id" }
      );

      // Also update global players.points for display
      await supabase.from("players").update({ points, is_playing: true }).eq("id", player.id);
    }
  } catch (err) {
    console.error("Error updating player stats:", err);
  }
}

// ─── API Fetch with Fallback ────────────────────────────────────────────────

async function apiFetch(url: string, supabase?: any, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    // Try direct fetch with timeout
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        console.log(`Direct fetch succeeded (attempt ${i + 1})`);
        return resp.json();
      }
    } catch (_) {
      console.log(`Direct fetch failed (attempt ${i + 1})`);
    }

    // Try RPC fallback
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc("http_get_json", { target_url: url });
        if (!error && data) {
          console.log(`RPC fallback succeeded (attempt ${i + 1})`);
          return data;
        }
      } catch (_) {
        console.log(`RPC fallback failed (attempt ${i + 1})`);
      }
    }

    if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error(`Failed to fetch after ${retries + 1} attempts`);
}

// ─── Scoring Functions ──────────────────────────────────────────────────────

function calculateBattingPoints(bat: any): number {
  const runs = bat.r || 0;
  const fours = bat.b4 || 0;
  const sixes = bat.b6 || 0;
  const balls = bat.b || 1;
  let points = runs + fours + sixes * 2;
  const sr = (runs / balls) * 100;
  if (balls >= 10) {
    if (sr > 170) points += 6;
    else if (sr > 150) points += 4;
    else if (sr > 130) points += 2;
    else if (sr < 50) points -= 6;
    else if (sr < 60) points -= 4;
  }
  if (runs >= 100) points += 16;
  else if (runs >= 50) points += 8;
  else if (runs >= 30) points += 4;
  if (runs === 0 && bat.out) points -= 2;
  return points;
}

function calculateBowlingPoints(bowl: any): number {
  const wickets = bowl.w || 0;
  const overs = bowl.o || 0;
  const runs = bowl.r || 0;
  let points = wickets * 25;
  if (wickets >= 5) points += 16;
  else if (wickets >= 4) points += 8;
  else if (wickets >= 3) points += 4;
  if (overs >= 2) {
    const economy = runs / overs;
    if (economy < 5) points += 6;
    else if (economy < 6) points += 4;
    else if (economy < 7) points += 2;
    else if (economy > 12) points -= 6;
    else if (economy > 11) points -= 4;
    else if (economy > 10) points -= 2;
  }
  points += (bowl.maiden || 0) * 12;
  return points;
}
