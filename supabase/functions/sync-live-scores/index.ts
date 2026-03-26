import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

// ─── Normalized Types ───────────────────────────────────────────────────────

interface PlayerStats {
  name: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  out?: boolean;
  wickets?: number;
  oversBowled?: number;
  runsConceded?: number;
  maidens?: number;
  catches?: number;
  runOuts?: number;
  stumpings?: number;
}

interface NormalizedScorecard {
  teamAScore: string | null;
  teamBScore: string | null;
  matchEnded: boolean;
  players: PlayerStats[];
  source: "cricapi" | "cricbuzz" | "espn";
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CRICAPI_KEY = Deno.env.get("CRICAPI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: liveMatches } = await supabase
      .from("matches")
      .select("id, external_id, cricbuzz_match_id, espn_match_id, team_a, team_b, team_a_logo, team_b_logo, status")
      .in("status", ["live"]);

    if (!liveMatches?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No live matches to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;

    for (const match of liveMatches) {
      try {
        // Try fallback chain: CricAPI → Cricbuzz → ESPN
        let scorecard: NormalizedScorecard | null = null;

        // 1. CricAPI
        if (!scorecard && CRICAPI_KEY && match.external_id) {
          scorecard = await tryCricAPI(CRICAPI_KEY, match.external_id, match, supabase);
        }

        // 2. Cricbuzz scraping
        if (!scorecard && match.cricbuzz_match_id) {
          scorecard = await tryCricbuzz(match.cricbuzz_match_id, match);
        }

        // 3. ESPN JSON
        if (!scorecard && match.espn_match_id) {
          scorecard = await tryESPN(match.espn_match_id, match);
        }

        if (!scorecard) {
          console.log(`All sources failed for match ${match.id}, awaiting manual entry`);
          continue;
        }

        // Update match scores
        const status = scorecard.matchEnded ? "completed" : "live";
        await supabase
          .from("matches")
          .update({ team_a_score: scorecard.teamAScore, team_b_score: scorecard.teamBScore, status })
          .eq("id", match.id);

        // Update Playing XI (only CricAPI has this)
        if (scorecard.source === "cricapi" && CRICAPI_KEY && match.external_id) {
          await updatePlayingXI(supabase, CRICAPI_KEY, match.external_id, match.id);
        }

        // Compute player points from normalized scorecard
        await computePlayerPoints(supabase, scorecard, match.id);

        // Recalculate user team points
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

// ─── Source 1: CricAPI ──────────────────────────────────────────────────────

async function tryCricAPI(
  apiKey: string,
  externalId: string,
  match: any,
  supabase: any
): Promise<NormalizedScorecard | null> {
  try {
    // Fetch match info for scores
    const data = await apiFetch(
      `${CRICAPI_BASE}/match_info?apikey=${encodeURIComponent(apiKey)}&id=${externalId}`,
      supabase
    );
    if (data.status !== "success" || !data.data) return null;

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

    // Fetch scorecard for player stats
    const scData = await apiFetch(
      `${CRICAPI_BASE}/match_scorecard?apikey=${encodeURIComponent(apiKey)}&id=${externalId}`,
      supabase
    );

    const players: PlayerStats[] = [];
    if (scData.status === "success" && scData.data?.scorecard) {
      for (const innings of scData.data.scorecard) {
        for (const bat of innings.batting || []) {
          if (!bat.batsman?.name) continue;
          const existing = players.find(p => p.name === bat.batsman.name);
          if (existing) {
            existing.runs = (existing.runs || 0) + (bat.r || 0);
            existing.balls = (existing.balls || 0) + (bat.b || 0);
            existing.fours = (existing.fours || 0) + (bat.b4 || 0);
            existing.sixes = (existing.sixes || 0) + (bat.b6 || 0);
            if (bat.out) existing.out = true;
          } else {
            players.push({
              name: bat.batsman.name,
              runs: bat.r || 0,
              balls: bat.b || 0,
              fours: bat.b4 || 0,
              sixes: bat.b6 || 0,
              out: !!bat.out,
            });
          }
        }
        for (const bowl of innings.bowling || []) {
          if (!bowl.bowler?.name) continue;
          const existing = players.find(p => p.name === bowl.bowler.name);
          if (existing) {
            existing.wickets = (existing.wickets || 0) + (bowl.w || 0);
            existing.oversBowled = (existing.oversBowled || 0) + (bowl.o || 0);
            existing.runsConceded = (existing.runsConceded || 0) + (bowl.r || 0);
            existing.maidens = (existing.maidens || 0) + (bowl.maiden || 0);
          } else {
            players.push({
              name: bowl.bowler.name,
              wickets: bowl.w || 0,
              oversBowled: bowl.o || 0,
              runsConceded: bowl.r || 0,
              maidens: bowl.maiden || 0,
            });
          }
        }
        for (const field of innings.catching || []) {
          if (!field.catcher?.name) continue;
          const existing = players.find(p => p.name === field.catcher.name);
          if (existing) {
            existing.catches = (existing.catches || 0) + (field.catches || 0);
            existing.runOuts = (existing.runOuts || 0) + (field.runOut || 0);
            existing.stumpings = (existing.stumpings || 0) + (field.stumpiing || 0);
          } else {
            players.push({
              name: field.catcher.name,
              catches: field.catches || 0,
              runOuts: field.runOut || 0,
              stumpings: field.stumpiing || 0,
            });
          }
        }
      }
    }

    console.log(`CricAPI succeeded for match ${match.id}`);
    return {
      teamAScore,
      teamBScore,
      matchEnded: !!m.matchEnded,
      players,
      source: "cricapi",
    };
  } catch (err) {
    console.log(`CricAPI failed for match ${match.id}:`, err);
    return null;
  }
}

// ─── Source 2: Cricbuzz Scraping ────────────────────────────────────────────

async function tryCricbuzz(
  cricbuzzId: string,
  match: any
): Promise<NormalizedScorecard | null> {
  try {
    const url = `https://www.cricbuzz.com/api/html/cricket-scorecard/${cricbuzzId}`;
    const resp = await fetchWithTimeout(url, 10000);
    if (!resp.ok) return null;
    const html = await resp.text();

    // Parse team scores from the page
    let teamAScore: string | null = null;
    let teamBScore: string | null = null;
    const matchEnded = html.includes("complete") || html.includes("won by") || html.includes("result");

    // Extract score patterns like "TeamName 185/4 (20.0)"
    const scoreRegex = /(\d+)\/(\d+)\s*\((\d+\.?\d*)\)/g;
    const scoreMatches = [...html.matchAll(scoreRegex)];
    if (scoreMatches.length >= 1) {
      teamAScore = `${scoreMatches[0][1]}/${scoreMatches[0][2]} (${scoreMatches[0][3]})`;
    }
    if (scoreMatches.length >= 2) {
      teamBScore = `${scoreMatches[1][1]}/${scoreMatches[1][2]} (${scoreMatches[1][3]})`;
    }

    // Parse batting stats: look for rows with player stats
    const players: PlayerStats[] = [];
    
    // Batting rows pattern: player name followed by runs, balls, 4s, 6s
    const batRegex = /class="[^"]*cb-col[^"]*"[^>]*>([^<]+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)/g;
    let batMatch;
    while ((batMatch = batRegex.exec(html)) !== null) {
      const name = batMatch[1].trim();
      if (name && name.length > 2 && !name.includes("Extras") && !name.includes("Total")) {
        players.push({
          name,
          runs: parseInt(batMatch[2]) || 0,
          balls: parseInt(batMatch[3]) || 0,
          fours: parseInt(batMatch[4]) || 0,
          sixes: parseInt(batMatch[5]) || 0,
        });
      }
    }

    // Bowling rows pattern: bowler name followed by overs, maidens, runs, wickets
    const bowlRegex = /class="[^"]*cb-col[^"]*"[^>]*>([^<]+)<[\s\S]*?(\d+\.?\d*)<[\s\S]*?(\d+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)/g;
    let bowlMatch;
    while ((bowlMatch = bowlRegex.exec(html)) !== null) {
      const name = bowlMatch[1].trim();
      if (name && name.length > 2) {
        const existing = players.find(p => normalizeName(p.name) === normalizeName(name));
        if (existing) {
          existing.oversBowled = parseFloat(bowlMatch[2]) || 0;
          existing.maidens = parseInt(bowlMatch[3]) || 0;
          existing.runsConceded = parseInt(bowlMatch[4]) || 0;
          existing.wickets = parseInt(bowlMatch[5]) || 0;
        } else {
          players.push({
            name,
            oversBowled: parseFloat(bowlMatch[2]) || 0,
            maidens: parseInt(bowlMatch[3]) || 0,
            runsConceded: parseInt(bowlMatch[4]) || 0,
            wickets: parseInt(bowlMatch[5]) || 0,
          });
        }
      }
    }

    if (!teamAScore && !teamBScore) return null;

    console.log(`Cricbuzz scraping succeeded for match ${match.id}, found ${players.length} players`);
    return { teamAScore, teamBScore, matchEnded, players, source: "cricbuzz" };
  } catch (err) {
    console.log(`Cricbuzz scraping failed for match ${match.id}:`, err);
    return null;
  }
}

// ─── Source 3: ESPN Cricinfo JSON ───────────────────────────────────────────

async function tryESPN(
  espnId: string,
  match: any
): Promise<NormalizedScorecard | null> {
  try {
    const url = `https://www.espncricinfo.com/matches/engine/match/${espnId}.json`;
    const resp = await fetchWithTimeout(url, 10000);
    if (!resp.ok) return null;
    const data = await resp.json();

    const innings = data.innings || [];
    let teamAScore: string | null = null;
    let teamBScore: string | null = null;
    const matchEnded = data.match?.match_status === "Complete" || data.match?.match_status === "Result";

    for (let i = 0; i < innings.length; i++) {
      const inn = innings[i];
      const score = `${inn.runs || 0}/${inn.wickets || 0} (${inn.overs || 0})`;
      // First innings team A, rest team B (simplified — could be more complex for tests)
      if (i % 2 === 0) {
        teamAScore = teamAScore ? `${teamAScore} & ${score}` : score;
      } else {
        teamBScore = teamBScore ? `${teamBScore} & ${score}` : score;
      }
    }

    const players: PlayerStats[] = [];
    for (const inn of innings) {
      for (const bat of inn.batsmen || []) {
        const name = bat.known_as || bat.popular_name || bat.card_long;
        if (!name) continue;
        const existing = players.find(p => normalizeName(p.name) === normalizeName(name));
        if (existing) {
          existing.runs = (existing.runs || 0) + (bat.runs || 0);
          existing.balls = (existing.balls || 0) + (bat.balls_faced || 0);
          existing.fours = (existing.fours || 0) + (bat.fours || 0);
          existing.sixes = (existing.sixes || 0) + (bat.sixes || 0);
          if (bat.how_out && bat.how_out !== "not out") existing.out = true;
        } else {
          players.push({
            name,
            runs: bat.runs || 0,
            balls: bat.balls_faced || 0,
            fours: bat.fours || 0,
            sixes: bat.sixes || 0,
            out: bat.how_out && bat.how_out !== "not out",
          });
        }
      }
      for (const bowl of inn.bowlers || []) {
        const name = bowl.known_as || bowl.popular_name || bowl.card_long;
        if (!name) continue;
        const existing = players.find(p => normalizeName(p.name) === normalizeName(name));
        if (existing) {
          existing.wickets = (existing.wickets || 0) + (bowl.wickets || 0);
          existing.oversBowled = (existing.oversBowled || 0) + (bowl.overs || 0);
          existing.runsConceded = (existing.runsConceded || 0) + (bowl.conceded || 0);
          existing.maidens = (existing.maidens || 0) + (bowl.maidens || 0);
        } else {
          players.push({
            name,
            wickets: bowl.wickets || 0,
            oversBowled: bowl.overs || 0,
            runsConceded: bowl.conceded || 0,
            maidens: bowl.maidens || 0,
          });
        }
      }
    }

    if (!teamAScore && !teamBScore) return null;

    console.log(`ESPN succeeded for match ${match.id}, found ${players.length} players`);
    return { teamAScore, teamBScore, matchEnded, players, source: "espn" };
  } catch (err) {
    console.log(`ESPN failed for match ${match.id}:`, err);
    return null;
  }
}

// ─── Compute Player Points from Normalized Scorecard ────────────────────────

async function computePlayerPoints(
  supabase: ReturnType<typeof createClient>,
  scorecard: NormalizedScorecard,
  matchId: string
) {
  // Get all players from DB for fuzzy matching
  const { data: dbPlayers } = await supabase
    .from("players")
    .select("id, name, team, external_id");

  if (!dbPlayers?.length) return;

  for (const ps of scorecard.players) {
    // Match by normalized name
    const dbPlayer = dbPlayers.find(
      (dp: any) => normalizeName(dp.name) === normalizeName(ps.name)
    ) || dbPlayers.find(
      (dp: any) => normalizeName(dp.name).includes(normalizeName(ps.name)) ||
                   normalizeName(ps.name).includes(normalizeName(dp.name))
    );

    if (!dbPlayer) continue;

    const points = calculatePoints(ps);

    await supabase.from("match_player_points").upsert(
      { match_id: matchId, player_id: dbPlayer.id, points, data_source: scorecard.source },
      { onConflict: "match_id,player_id" }
    );

    await supabase.from("players").update({ points, is_playing: true }).eq("id", dbPlayer.id);
  }
}

// ─── Points Calculation (unified) ───────────────────────────────────────────

function calculatePoints(ps: PlayerStats): number {
  let points = 0;

  // Batting
  const runs = ps.runs || 0;
  const balls = ps.balls || 1;
  const fours = ps.fours || 0;
  const sixes = ps.sixes || 0;

  if (runs > 0 || ps.out !== undefined) {
    points += runs + fours + sixes * 2;
    const sr = (runs / Math.max(balls, 1)) * 100;
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
    if (runs === 0 && ps.out) points -= 2;
  }

  // Bowling
  const wickets = ps.wickets || 0;
  const overs = ps.oversBowled || 0;
  const runsConceded = ps.runsConceded || 0;

  if (wickets > 0 || overs > 0) {
    points += wickets * 25;
    if (wickets >= 5) points += 16;
    else if (wickets >= 4) points += 8;
    else if (wickets >= 3) points += 4;
    if (overs >= 2) {
      const economy = runsConceded / overs;
      if (economy < 5) points += 6;
      else if (economy < 6) points += 4;
      else if (economy < 7) points += 2;
      else if (economy > 12) points -= 6;
      else if (economy > 11) points -= 4;
      else if (economy > 10) points -= 2;
    }
    points += (ps.maidens || 0) * 12;
  }

  // Fielding
  points += (ps.catches || 0) * 8;
  points += (ps.runOuts || 0) * 12;
  points += (ps.stumpings || 0) * 12;

  return points;
}

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
      const { data: teamPlayers } = await supabase
        .from("team_players")
        .select("player_id")
        .eq("user_team_id", ut.id);

      if (!teamPlayers?.length) continue;

      const playerIds = teamPlayers.map((tp: any) => tp.player_id);

      const { data: matchPoints } = await supabase
        .from("match_player_points")
        .select("player_id, points")
        .eq("match_id", matchId)
        .in("player_id", playerIds);

      const pointsMap = new Map((matchPoints || []).map((mp: any) => [mp.player_id, mp.points]));

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

    const userIds = [...new Set(userTeams.map((ut: any) => ut.user_id))];
    for (const userId of userIds) {
      const { data: allTeams } = await supabase
        .from("user_teams")
        .select("total_points")
        .eq("user_id", userId);

      const totalProfile = (allTeams || []).reduce((s: number, t: any) => s + (t.total_points || 0), 0);
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

// ─── Utilities ──────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

async function apiFetch(url: string, supabase?: any, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetchWithTimeout(url, 10000);
      if (resp.ok) {
        console.log(`Direct fetch succeeded (attempt ${i + 1})`);
        return resp.json();
      }
    } catch (_) {
      console.log(`Direct fetch failed (attempt ${i + 1})`);
    }

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
