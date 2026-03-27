import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

    // ── Auto-transition upcoming → live ──
    await supabase
      .from("matches")
      .update({ status: "live" })
      .eq("status", "upcoming")
      .lte("match_date", new Date().toISOString());

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

    // ── Auto-discover match IDs (Cricbuzz → ESPN → CricAPI) ──
    const needsDiscovery = liveMatches.filter(m =>
      !m.cricbuzz_match_id || !m.espn_match_id
    );
    if (needsDiscovery.length > 0) {
      // Try Cricbuzz discovery
      await discoverCricbuzzIds(supabase, needsDiscovery);
      // Try ESPN discovery
      await discoverESPNIds(supabase, needsDiscovery);
      // Try CricAPI discovery as last resort
      if (CRICAPI_KEY) {
        await discoverCricAPIIds(supabase, CRICAPI_KEY, needsDiscovery);
      }
    }

    // ── Load alias map once ──
    const aliasMap = await loadAliasMap(supabase);

    let updated = 0;

    for (const match of liveMatches) {
      try {
        let scorecard: NormalizedScorecard | null = null;

        // 1. Cricbuzz (free, no key, most reliable)
        if (!scorecard && match.cricbuzz_match_id) {
          scorecard = await tryCricbuzz(match.cricbuzz_match_id, match, supabase);
        }

        // 2. ESPN Cricinfo (free, no key)
        if (!scorecard && match.espn_match_id) {
          scorecard = await tryESPN(match.espn_match_id, match);
        }

        // 3. CricAPI (paid, currently has SSL issues)
        if (!scorecard && CRICAPI_KEY && match.external_id) {
          scorecard = await tryCricAPI(CRICAPI_KEY, match.external_id, match, supabase);
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
        await computePlayerPoints(supabase, scorecard, match.id, aliasMap);

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

// ─── Alias Map Loader ──────────────────────────────────────────────────────

async function loadAliasMap(supabase: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const map = new Map<string, string>(); // normalized alias → player_id
  const { data } = await supabase.from("player_aliases").select("player_id, alias");
  if (data) {
    for (const row of data) {
      map.set(normalizeName(row.alias), row.player_id);
    }
  }
  return map;
}

// ─── Source 1: CricAPI ──────────────────────────────────────────────────────

async function tryCricAPI(
  apiKey: string,
  externalId: string,
  match: any,
  supabase: any
): Promise<NormalizedScorecard | null> {
  try {
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
    return { teamAScore, teamBScore, matchEnded: !!m.matchEnded, players, source: "cricapi" };
  } catch (err) {
    console.log(`CricAPI failed for match ${match.id}:`, err);
    return null;
  }
}

// ─── Source 2: Cricbuzz JSON API ───────────────────────────────────────────

async function tryCricbuzz(
  cricbuzzId: string,
  match: any,
  supabase?: any
): Promise<NormalizedScorecard | null> {
  try {
    // Primary: scrape scorecard page via DB http extension (bypasses edge function network issues)
    if (supabase) {
      try {
        console.log(`Cricbuzz: fetching scorecard for ID ${cricbuzzId} via RPC`);
        const { data: html, error } = await supabase.rpc("http_get_text", {
          target_url: `https://www.cricbuzz.com/live-cricket-scorecard/${cricbuzzId}`
        });
        if (error) {
          console.log(`Cricbuzz RPC error: ${error.message}`);
        } else if (html) {
          console.log(`Cricbuzz: got ${html.length} chars HTML, parsing...`);
          const result = parseCricbuzzRSC(html, match);
          if (result) {
            console.log(`Cricbuzz RSC scorecard succeeded for match ${match.id}, ${result.players.length} players, scores: ${result.teamAScore} / ${result.teamBScore}`);
            return result;
          } else {
            console.log(`Cricbuzz: RSC parsing returned null`);
          }
        } else {
          console.log(`Cricbuzz: RPC returned no data and no error`);
        }
      } catch (e) {
        console.log(`Cricbuzz RPC exception: ${e}`);
      }
    }

    // Fallback: direct fetch
    const commentaryUrl = `https://www.cricbuzz.com/match-api/${cricbuzzId}/commentary.json`;
    let resp = await fetchWithTimeout(commentaryUrl, 10000, { "User-Agent": BROWSER_UA });
    
    if (resp.ok) {
      try {
        const data = await resp.json();
        const result = parseCricbuzzCommentary(data, match);
        if (result) {
          console.log(`Cricbuzz commentary JSON succeeded for match ${match.id}`);
          return result;
        }
      } catch (_) { /* fall through */ }
    }

    return null;
  } catch (err) {
    console.log(`Cricbuzz failed for match ${match.id}:`, err);
    return null;
  }
}

// Parse Cricbuzz Next.js RSC payload embedded in the scorecard HTML page
function parseCricbuzzRSC(html: string, match: any): NormalizedScorecard | null {
  try {
    const players: PlayerStats[] = [];
    let teamAScore: string | null = null;
    let teamBScore: string | null = null;
    let matchEnded = false;

    // Check match status
    if (html.includes('"state":"Complete"') || html.includes('won by') || html.includes('"matchEnded":true')) {
      matchEnded = true;
    }

    // Extract score info from RSC: look for "runs":N,"wickets":N,"overs":N patterns near team names
    // Extract innings scores: pattern like "scoreTitle":"Team Innings","runs":150,"wickets":5,"overs":18.2
    const scoreRegex = /"(?:scoreTitle|inningsId)"[^}]*?"runs":(\d+)[^}]*?"wickets":(\d+)[^}]*?"overs":([\d.]+)/g;
    let scoreMatch;
    let inningsIdx = 0;
    while ((scoreMatch = scoreRegex.exec(html)) !== null) {
      const score = `${scoreMatch[1]}/${scoreMatch[2]} (${scoreMatch[3]})`;
      if (inningsIdx % 2 === 0) {
        teamAScore = teamAScore ? `${teamAScore} & ${score}` : score;
      } else {
        teamBScore = teamBScore ? `${teamBScore} & ${score}` : score;
      }
      inningsIdx++;
    }

    // If no structured scores found, try simple regex on the full HTML
    if (!teamAScore && !teamBScore) {
      const simpleScoreRegex = /(\d{1,3})\/(\d{1,2})\s*\((\d{1,2}\.?\d?)\)/g;
      const simpleMatches = [...html.matchAll(simpleScoreRegex)];
      if (simpleMatches.length >= 1) {
        teamAScore = `${simpleMatches[0][1]}/${simpleMatches[0][2]} (${simpleMatches[0][3]})`;
      }
      if (simpleMatches.length >= 2) {
        teamBScore = `${simpleMatches[1][1]}/${simpleMatches[1][2]} (${simpleMatches[1][3]})`;
      }
    }

    if (!teamAScore && !teamBScore) return null;

    // Extract batsmen from RSC: "batName":"Player Name","runs":X,"balls":Y,"fours":Z,"sixes":W
    const batRegex = /"batName":"([^"]+)"[^}]*?"runs":(\d+)[^}]*?"balls":(\d+)[^}]*?"(?:dots":\d+[^}]*?")?"fours":(\d+)[^}]*?"sixes":(\d+)/g;
    let batMatch;
    while ((batMatch = batRegex.exec(html)) !== null) {
      const name = batMatch[1];
      if (!name || name === "undefined") continue;
      // Check if out: look for outDesc near this player
      const outDescRegex = new RegExp(`"batName":"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*?"outDesc":"([^"]*)"`, 'g');
      const outMatch = outDescRegex.exec(html);
      const isOut = outMatch ? !outMatch[1].includes("not out") && outMatch[1] !== "" : undefined;
      
      mergePlayer(players, {
        name,
        runs: parseInt(batMatch[2]) || 0,
        balls: parseInt(batMatch[3]) || 0,
        fours: parseInt(batMatch[4]) || 0,
        sixes: parseInt(batMatch[5]) || 0,
        out: isOut,
      });
    }

    // Extract bowlers: "bowlName":"Player Name","overs":X,"maidens":Y,"runs":Z,"wickets":W
    const bowlRegex = /"bowlName":"([^"]+)"[^}]*?"overs":([\d.]+)[^}]*?"maidens":(\d+)[^}]*?"runs":(\d+)[^}]*?"wickets":(\d+)/g;
    let bowlMatch;
    while ((bowlMatch = bowlRegex.exec(html)) !== null) {
      const name = bowlMatch[1];
      if (!name || name === "undefined") continue;
      mergePlayer(players, {
        name,
        oversBowled: parseFloat(bowlMatch[2]) || 0,
        maidens: parseInt(bowlMatch[3]) || 0,
        runsConceded: parseInt(bowlMatch[4]) || 0,
        wickets: parseInt(bowlMatch[5]) || 0,
      });
    }

    return { teamAScore, teamBScore, matchEnded, players, source: "cricbuzz" };
  } catch (_) {
    return null;
  }
}

function parseCricbuzzCommentary(data: any, match: any): NormalizedScorecard | null {
  try {
    const matchHeader = data.matchHeader || data.miniscore?.matchScoreDetails;
    if (!matchHeader) return null;

    const inningsScores = matchHeader.inningsScores || data.miniscore?.matchScoreDetails?.inningsScores || [];
    let teamAScore: string | null = null;
    let teamBScore: string | null = null;
    const matchEnded = matchHeader.state === "Complete" || matchHeader.status?.includes("won");

    for (const inn of inningsScores) {
      const inningsInfo = inn.inningsScore?.[0] || inn;
      const runs = inningsInfo.runs ?? inningsInfo.score ?? 0;
      const wickets = inningsInfo.wickets ?? 0;
      const overs = inningsInfo.overs ?? 0;
      const score = `${runs}/${wickets} (${overs})`;
      const batTeamName = inningsInfo.batTeamName || inningsInfo.batTeamShortName || "";

      if (batTeamName.includes(match.team_a) || match.team_a.includes(batTeamName)) {
        teamAScore = teamAScore ? `${teamAScore} & ${score}` : score;
      } else {
        teamBScore = teamBScore ? `${teamBScore} & ${score}` : score;
      }
    }

    if (!teamAScore && !teamBScore) return null;

    // Player stats from scorecard sections if available
    const players: PlayerStats[] = [];
    const scorecard = data.scorecard || data.scorecardSummary;
    if (scorecard) {
      for (const inn of Array.isArray(scorecard) ? scorecard : [scorecard]) {
        for (const bat of inn.batsmen || inn.batting || []) {
          const name = bat.name || bat.batName || bat.batsman?.name;
          if (!name) continue;
          mergePlayer(players, {
            name,
            runs: bat.runs ?? bat.r ?? 0,
            balls: bat.balls ?? bat.b ?? 0,
            fours: bat.fours ?? bat.b4 ?? 0,
            sixes: bat.sixes ?? bat.b6 ?? 0,
            out: bat.outDesc ? !bat.outDesc.includes("not out") : undefined,
          });
        }
        for (const bowl of inn.bowlers || inn.bowling || []) {
          const name = bowl.name || bowl.bowlName || bowl.bowler?.name;
          if (!name) continue;
          mergePlayer(players, {
            name,
            wickets: bowl.wickets ?? bowl.w ?? 0,
            oversBowled: parseFloat(bowl.overs ?? bowl.o ?? "0"),
            runsConceded: bowl.runsConceded ?? bowl.r ?? 0,
            maidens: bowl.maidens ?? bowl.maiden ?? 0,
          });
        }
      }
    }

    return { teamAScore, teamBScore, matchEnded, players, source: "cricbuzz" };
  } catch (_) {
    return null;
  }
}

function parseCricbuzzHTML(html: string, match: any): NormalizedScorecard | null {
  let teamAScore: string | null = null;
  let teamBScore: string | null = null;
  const matchEnded = html.includes("complete") || html.includes("won by") || html.includes("result");

  const scoreRegex = /(\d+)\/(\d+)\s*\((\d+\.?\d*)\)/g;
  const scoreMatches = [...html.matchAll(scoreRegex)];
  if (scoreMatches.length >= 1) {
    teamAScore = `${scoreMatches[0][1]}/${scoreMatches[0][2]} (${scoreMatches[0][3]})`;
  }
  if (scoreMatches.length >= 2) {
    teamBScore = `${scoreMatches[1][1]}/${scoreMatches[1][2]} (${scoreMatches[1][3]})`;
  }

  if (!teamAScore && !teamBScore) return null;

  const players: PlayerStats[] = [];
  // Simple regex extraction kept as last resort
  const batRegex = /class="[^"]*cb-col[^"]*"[^>]*>([^<]+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)<[\s\S]*?(\d+)/g;
  let batMatch;
  while ((batMatch = batRegex.exec(html)) !== null) {
    const name = batMatch[1].trim();
    if (name && name.length > 2 && !name.includes("Extras") && !name.includes("Total")) {
      players.push({ name, runs: parseInt(batMatch[2]) || 0, balls: parseInt(batMatch[3]) || 0, fours: parseInt(batMatch[4]) || 0, sixes: parseInt(batMatch[5]) || 0 });
    }
  }

  return { teamAScore, teamBScore, matchEnded, players, source: "cricbuzz" };
}

// ─── Source 3: ESPN Cricinfo (Modern API) ──────────────────────────────────

async function tryESPN(
  espnId: string,
  match: any
): Promise<NormalizedScorecard | null> {
  // Try modern hs-consumer-api first, then legacy
  const result = await tryESPNModern(espnId, match) || await tryESPNLegacy(espnId, match);
  return result;
}

async function tryESPNModern(
  espnId: string,
  match: any
): Promise<NormalizedScorecard | null> {
  try {
    const url = `https://hs-consumer-api.espncricinfo.com/v1/pages/match/scoreboard?lang=en&matchId=${espnId}`;
    const resp = await fetchWithTimeout(url, 10000, { "User-Agent": BROWSER_UA, "Accept": "application/json" });
    if (!resp.ok) return null;
    const data = await resp.json();

    const scorecard = data.content?.scorecard;
    const matchInfo = data.match || data.content?.match;
    if (!scorecard) return null;

    const matchEnded = matchInfo?.state === "FINISHED" || matchInfo?.state === "RESULT";
    let teamAScore: string | null = null;
    let teamBScore: string | null = null;
    const players: PlayerStats[] = [];

    for (let i = 0; i < scorecard.length; i++) {
      const inn = scorecard[i];
      const runs = inn.runs ?? inn.team?.innings?.runs ?? 0;
      const wickets = inn.wickets ?? inn.team?.innings?.wickets ?? 0;
      const overs = inn.overs ?? inn.team?.innings?.overs ?? 0;
      const score = `${runs}/${wickets} (${overs})`;

      if (i % 2 === 0) {
        teamAScore = teamAScore ? `${teamAScore} & ${score}` : score;
      } else {
        teamBScore = teamBScore ? `${teamBScore} & ${score}` : score;
      }

      for (const bat of inn.batsmen || inn.inningBatsmen || []) {
        const name = bat.player?.longName || bat.player?.name || bat.knownAs;
        if (!name) continue;
        mergePlayer(players, {
          name,
          runs: bat.runs ?? 0,
          balls: bat.ballsFaced ?? bat.balls ?? 0,
          fours: bat.fours ?? 0,
          sixes: bat.sixes ?? 0,
          out: bat.isOut ?? (bat.dismissalText && !bat.dismissalText.includes("not out")),
        });
      }

      for (const bowl of inn.bowlers || inn.inningBowlers || []) {
        const name = bowl.player?.longName || bowl.player?.name || bowl.knownAs;
        if (!name) continue;
        mergePlayer(players, {
          name,
          wickets: bowl.wickets ?? 0,
          oversBowled: parseFloat(bowl.overs ?? "0"),
          runsConceded: bowl.conceded ?? bowl.runs ?? 0,
          maidens: bowl.maidens ?? 0,
        });
      }
    }

    if (!teamAScore && !teamBScore) return null;
    console.log(`ESPN modern API succeeded for match ${match.id}, found ${players.length} players`);
    return { teamAScore, teamBScore, matchEnded, players, source: "espn" };
  } catch (err) {
    console.log(`ESPN modern API failed for match ${match.id}:`, err);
    return null;
  }
}

async function tryESPNLegacy(
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
        mergePlayer(players, {
          name,
          runs: bat.runs || 0,
          balls: bat.balls_faced || 0,
          fours: bat.fours || 0,
          sixes: bat.sixes || 0,
          out: bat.how_out && bat.how_out !== "not out",
        });
      }
      for (const bowl of inn.bowlers || []) {
        const name = bowl.known_as || bowl.popular_name || bowl.card_long;
        if (!name) continue;
        mergePlayer(players, {
          name,
          wickets: bowl.wickets || 0,
          oversBowled: bowl.overs || 0,
          runsConceded: bowl.conceded || 0,
          maidens: bowl.maidens || 0,
        });
      }
    }

    if (!teamAScore && !teamBScore) return null;
    console.log(`ESPN legacy succeeded for match ${match.id}, found ${players.length} players`);
    return { teamAScore, teamBScore, matchEnded, players, source: "espn" };
  } catch (err) {
    console.log(`ESPN legacy failed for match ${match.id}:`, err);
    return null;
  }
}

// ─── Compute Player Points ─────────────────────────────────────────────────

async function computePlayerPoints(
  supabase: ReturnType<typeof createClient>,
  scorecard: NormalizedScorecard,
  matchId: string,
  aliasMap: Map<string, string>
) {
  const { data: dbPlayers } = await supabase
    .from("players")
    .select("id, name, team, external_id");

  if (!dbPlayers?.length) return;

  for (const ps of scorecard.players) {
    // Match by normalized name
    const normalizedPs = normalizeName(ps.name);
    let dbPlayer = dbPlayers.find(
      (dp: any) => normalizeName(dp.name) === normalizedPs
    ) || dbPlayers.find(
      (dp: any) => normalizeName(dp.name).includes(normalizedPs) ||
                   normalizedPs.includes(normalizeName(dp.name))
    );

    // Fallback: check alias map
    if (!dbPlayer) {
      const aliasPlayerId = aliasMap.get(normalizedPs);
      if (aliasPlayerId) {
        dbPlayer = dbPlayers.find((dp: any) => dp.id === aliasPlayerId);
      }
    }

    if (!dbPlayer) continue;

    const points = calculatePoints(ps);

    await supabase.from("match_player_points").upsert(
      { match_id: matchId, player_id: dbPlayer.id, points, data_source: scorecard.source },
      { onConflict: "match_id,player_id" }
    );

    const { data: allMatchPoints } = await supabase
      .from("match_player_points")
      .select("points")
      .eq("player_id", dbPlayer.id);
    const totalPoints = (allMatchPoints || []).reduce((sum: number, row: any) => sum + (row.points || 0), 0);
    await supabase.from("players").update({ points: totalPoints, is_playing: true }).eq("id", dbPlayer.id);
  }
}

// ─── Points Calculation ─────────────────────────────────────────────────────

function calculatePoints(ps: PlayerStats): number {
  let points = 0;

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
      if (player?.external_id && playingXIIds.has(player.external_id)) {
        await supabase.from("players").update({ is_playing: true }).eq("id", player.id);
        continue;
      }
      if (!player?.external_id) {
        await supabase.from("players").update({ is_playing: true }).eq("id", player.id);
        continue;
      }
    }
  } catch (err) {
    console.error("Error updating Playing XI:", err);
  }
}

// ─── Auto-Discovery Functions ───────────────────────────────────────────────

const PSL_TEAM_KEYWORDS: Record<string, string[]> = {
  "Quetta": ["quetta", "gladiators"],
  "Karachi": ["karachi", "kings"],
  "Lahore": ["lahore", "qalandars"],
  "Islamabad": ["islamabad", "united"],
  "Peshawar": ["peshawar", "zalmi"],
  "Multan": ["multan", "sultans"],
  "Rawalpindi": ["rawalpindi", "raiders"],
};

function teamMatchesKeywords(teamName: string, target: string): boolean {
  const targetLower = target.toLowerCase();
  // Direct substring match
  if (targetLower.includes(teamName.toLowerCase())) return true;
  // Check PSL keywords
  for (const [key, keywords] of Object.entries(PSL_TEAM_KEYWORDS)) {
    if (teamName.toLowerCase().includes(key.toLowerCase())) {
      return keywords.some(kw => targetLower.includes(kw));
    }
  }
  return false;
}

async function discoverCricbuzzIds(supabase: any, matches: any[]) {
  const needsCricbuzz = matches.filter(m => !m.cricbuzz_match_id);
  if (!needsCricbuzz.length) return;

  try {
    // Scrape the Cricbuzz live-scores HTML page via DB http extension (proven to work)
    const { data: html, error } = await supabase.rpc("http_get_text", {
      target_url: "https://www.cricbuzz.com/live-cricket-scores"
    });
    if (error || !html) {
      console.log("Cricbuzz discovery failed:", error?.message);
      return;
    }

    // Extract match links: /live-cricket-scores/{id}/{slug}
    const linkRegex = /href="\/live-cricket-scores\/(\d+)\/([^"]+)"/g;
    const cbMatches: { id: string; slug: string }[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      cbMatches.push({ id: linkMatch[1], slug: linkMatch[2] });
    }

    for (const dbMatch of needsCricbuzz) {
      const teamALower = dbMatch.team_a.toLowerCase();
      const teamBLower = dbMatch.team_b.toLowerCase();
      
      const found = cbMatches.find(cb => {
        const slug = cb.slug.toLowerCase().replace(/-/g, ' ');
        // Check PSL team abbreviations and names in the slug
        const matchesA = teamMatchesKeywords(dbMatch.team_a, slug);
        const matchesB = teamMatchesKeywords(dbMatch.team_b, slug);
        return matchesA && matchesB;
      });

      if (found) {
        console.log(`Cricbuzz: discovered ID ${found.id} (${found.slug}) for ${dbMatch.team_a} vs ${dbMatch.team_b}`);
        await supabase.from("matches").update({ cricbuzz_match_id: found.id }).eq("id", dbMatch.id);
        dbMatch.cricbuzz_match_id = found.id;
      }
    }
  } catch (err) {
    console.log("Cricbuzz discovery failed:", err);
  }
}

async function discoverESPNIds(supabase: any, matches: any[]) {
  const needsESPN = matches.filter(m => !m.espn_match_id);
  if (!needsESPN.length) return;

  try {
    const url = "https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current?lang=en";
    let data: any;

    try {
      const resp = await fetchWithTimeout(url, 10000, {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json"
      });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (_) {
      console.log("ESPN discovery direct fetch failed, trying RPC");
    }

    if (!data) {
      const { data: rpcData, error } = await supabase.rpc("http_get_json", { target_url: url });
      if (error || !rpcData) {
        console.log("ESPN discovery via RPC also failed:", error?.message);
        return;
      }
      data = rpcData;
    }

    const espnMatches = data.matches || data.content?.matches || [];
    for (const dbMatch of needsESPN) {
      const found = espnMatches.find((em: any) => {
        const match = em.match || em;
        const teams = match.teams || [];
        const team1 = teams[0]?.team?.longName || teams[0]?.team?.name || teams[0]?.team?.abbreviation || "";
        const team2 = teams[1]?.team?.longName || teams[1]?.team?.name || teams[1]?.team?.abbreviation || "";
        return (teamMatchesKeywords(dbMatch.team_a, team1) && teamMatchesKeywords(dbMatch.team_b, team2)) ||
               (teamMatchesKeywords(dbMatch.team_a, team2) && teamMatchesKeywords(dbMatch.team_b, team1));
      });
      if (found) {
        const espnId = String((found.match || found).objectId || (found.match || found).id || (found.match || found).slug);
        console.log(`ESPN: discovered ID ${espnId} for ${dbMatch.team_a} vs ${dbMatch.team_b}`);
        await supabase.from("matches").update({ espn_match_id: espnId }).eq("id", dbMatch.id);
        dbMatch.espn_match_id = espnId;
      }
    }
  } catch (err) {
    console.log("ESPN discovery failed:", err);
  }
}

async function discoverCricAPIIds(supabase: any, apiKey: string, matches: any[]) {
  const needsCricAPI = matches.filter(m => !m.external_id || isUUID(m.external_id));
  if (!needsCricAPI.length) return;

  try {
    const apiData = await apiFetch(
      `${CRICAPI_BASE}/currentMatches?apikey=${encodeURIComponent(apiKey)}&offset=0`,
      supabase
    );
    if (apiData.status !== "success" || !apiData.data) return;

    for (const dbMatch of needsCricAPI) {
      const found = apiData.data.find((cm: any) => {
        if (!cm.id || !cm.name) return false;
        const nameLower = cm.name.toLowerCase();
        return nameLower.includes(dbMatch.team_a.toLowerCase()) &&
               nameLower.includes(dbMatch.team_b.toLowerCase());
      });
      if (found) {
        console.log(`CricAPI: discovered ID ${found.id} for ${dbMatch.team_a} vs ${dbMatch.team_b}`);
        await supabase.from("matches").update({ external_id: found.id }).eq("id", dbMatch.id);
        dbMatch.external_id = found.id;
      }
    }
  } catch (err) {
    console.log("CricAPI discovery failed:", err);
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function mergePlayer(players: PlayerStats[], incoming: PlayerStats) {
  const normalized = normalizeName(incoming.name);
  const existing = players.find(p => normalizeName(p.name) === normalized);
  if (existing) {
    if (incoming.runs !== undefined) {
      existing.runs = (existing.runs || 0) + (incoming.runs || 0);
      existing.balls = (existing.balls || 0) + (incoming.balls || 0);
      existing.fours = (existing.fours || 0) + (incoming.fours || 0);
      existing.sixes = (existing.sixes || 0) + (incoming.sixes || 0);
      if (incoming.out) existing.out = true;
    }
    if (incoming.wickets !== undefined || incoming.oversBowled !== undefined) {
      existing.wickets = (existing.wickets || 0) + (incoming.wickets || 0);
      existing.oversBowled = (existing.oversBowled || 0) + (incoming.oversBowled || 0);
      existing.runsConceded = (existing.runsConceded || 0) + (incoming.runsConceded || 0);
      existing.maidens = (existing.maidens || 0) + (incoming.maidens || 0);
    }
    if (incoming.catches !== undefined) existing.catches = (existing.catches || 0) + (incoming.catches || 0);
    if (incoming.runOuts !== undefined) existing.runOuts = (existing.runOuts || 0) + (incoming.runOuts || 0);
    if (incoming.stumpings !== undefined) existing.stumpings = (existing.stumpings || 0) + (incoming.stumpings || 0);
  } else {
    players.push({ ...incoming });
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers });
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
