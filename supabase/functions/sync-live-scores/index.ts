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

    // Get live matches from our DB
    const { data: liveMatches } = await supabase
      .from("matches")
      .select("id, external_id, team_a, team_b, team_a_logo, team_b_logo")
      .eq("status", "live");

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
        const res = await fetch(
          `${CRICAPI_BASE}/match_info?apikey=${CRICAPI_KEY}&id=${extId}`
        );
        if (!res.ok) continue;

        const data = await res.json();
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
          .update({
            team_a_score: teamAScore,
            team_b_score: teamBScore,
            status,
          })
          .eq("id", match.id);

        // Update player stats from scorecard
        const scorecardRes = await fetch(
          `${CRICAPI_BASE}/match_scorecard?apikey=${CRICAPI_KEY}&id=${extId}`
        );
        if (scorecardRes.ok) {
          const scData = await scorecardRes.json();
          if (scData.status === "success" && scData.data?.scorecard) {
            for (const innings of scData.data.scorecard) {
              for (const bat of innings.batting || []) {
                if (bat.batsman?.id) {
                  const points = calculateBattingPoints(bat);
                  const { data: existingPlayer } = await supabase
                    .from("players")
                    .select("id")
                    .eq("external_id", bat.batsman.id)
                    .maybeSingle();

                  if (existingPlayer) {
                    await supabase
                      .from("players")
                      .update({ points, is_playing: true })
                      .eq("id", existingPlayer.id);
                  }
                }
              }
              for (const bowl of innings.bowling || []) {
                if (bowl.bowler?.id) {
                  const points = calculateBowlingPoints(bowl);
                  const { data: existingPlayer } = await supabase
                    .from("players")
                    .select("id, points")
                    .eq("external_id", bowl.bowler.id)
                    .maybeSingle();

                  if (existingPlayer) {
                    await supabase
                      .from("players")
                      .update({
                        points: (existingPlayer.points || 0) + points,
                        is_playing: true,
                      })
                      .eq("id", existingPlayer.id);
                  }
                }
              }
              for (const field of innings.catching || []) {
                if (field.catcher?.id) {
                  const catchPoints = (field.catches || 0) * 8 + (field.runOut || 0) * 12;
                  if (catchPoints > 0) {
                    const { data: existingPlayer } = await supabase
                      .from("players")
                      .select("id, points")
                      .eq("external_id", field.catcher.id)
                      .maybeSingle();

                    if (existingPlayer) {
                      await supabase
                        .from("players")
                        .update({ points: (existingPlayer.points || 0) + catchPoints })
                        .eq("id", existingPlayer.id);
                    }
                  }
                }
              }
            }
          }
        }

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
