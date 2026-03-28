import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = ["admin@psl.com", "sameer@psl.com"];

const PSL_TEAM_KEYWORDS: Record<string, string[]> = {
  "Quetta": ["quetta", "gladiators", "qtg"],
  "Karachi": ["karachi", "kings", "krk"],
  "Lahore": ["lahore", "qalandars", "lhq"],
  "Islamabad": ["islamabad", "united", "isu"],
  "Peshawar": ["peshawar", "zalmi", "psz"],
  "Multan": ["multan", "sultans", "ms"],
  "Rawalpindi": ["rawalpindi", "raiders", "pindiz", "rwp"],
  "Hyderabad": ["hyderabad", "kingsmen", "hydk"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use anon client to verify the user
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = claimsData.claims.email as string;
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return new Response(JSON.stringify({ error: "Forbidden: not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for actual updates (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { match_id, team_a_score, team_b_score, status, cricbuzz_match_id, espn_match_id, player_points, recalculate } = body;

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Recalculate mode: re-fetch scorecard from Cricbuzz and recompute all points ──
    if (recalculate) {
      const result = await recalculateFromSource(supabase, match_id);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Manual update mode ──
    // Update match scores
    const { error: matchError } = await supabase
      .from("matches")
      .update({
        team_a_score: team_a_score || null,
        team_b_score: team_b_score || null,
        status: status || "live",
        cricbuzz_match_id: cricbuzz_match_id || null,
        espn_match_id: espn_match_id || null,
      })
      .eq("id", match_id);

    if (matchError) throw matchError;

    // Upsert player points
    if (player_points && Array.isArray(player_points)) {
      for (const pp of player_points) {
        await supabase.from("match_player_points").upsert(
          {
            match_id,
            player_id: pp.player_id,
            points: pp.points,
            data_source: "manual",
          },
          { onConflict: "match_id,player_id" }
        );
      }

      // Update players.points as SUM across all matches
      const playerIds = player_points.map((pp: any) => pp.player_id);
      for (const playerId of playerIds) {
        const { data: allPoints } = await supabase
          .from("match_player_points")
          .select("points")
          .eq("player_id", playerId);
        const totalPoints = (allPoints || []).reduce((sum: number, row: any) => sum + (row.points || 0), 0);
        await supabase.from("players").update({ points: totalPoints }).eq("id", playerId);
      }
    }

    // Recalculate user team points for this match
    await recalcUserTeamPoints(supabase, match_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Admin update error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Recalculate from Cricbuzz scorecard ────────────────────────────────────

async function recalculateFromSource(supabase: any, matchId: string) {
  const { data: match } = await supabase
    .from("matches")
    .select("id, team_a, team_b, cricbuzz_match_id, espn_match_id, status, winning_team")
    .eq("id", matchId)
    .single();

  if (!match) throw new Error("Match not found");

  const cricbuzzId = match.cricbuzz_match_id;
  if (!cricbuzzId) {
    return { success: false, error: "No cricbuzz_match_id set for this match. Set it first." };
  }

  console.log(`Recalculating match ${matchId} from Cricbuzz ID ${cricbuzzId}`);

  // Fetch scorecard page via DB http extension
  const { data: scHtml, error: scError } = await supabase.rpc("http_get_text", {
    target_url: `https://www.cricbuzz.com/live-cricket-scorecard/${cricbuzzId}`
  });
  if (scError || !scHtml || scHtml.length < 1000) {
    return { success: false, error: `Failed to fetch scorecard: ${scError?.message || 'empty response'}` };
  }

  console.log(`Scorecard page: ${scHtml.length} chars`);

  // Parse players from scorecard
  const players = parseScorecardPlayers(scHtml);
  console.log(`Parsed ${players.length} players from scorecard`);

  // Extract winning team from live scores page
  let winningTeam = match.winning_team;
  let playerOfTheMatch: string | null = null;

  const { data: liveHtml } = await supabase.rpc("http_get_text", {
    target_url: `https://www.cricbuzz.com/live-cricket-scores/${cricbuzzId}`
  });

  if (liveHtml) {
    // Extract winning team
    if (!winningTeam) {
      const statusRegex = /\\?"status\\?":\s*\\?"([^"\\]+)\\?"/;
      const statusMatch = liveHtml.match(statusRegex);
      winningTeam = extractWinningTeam(statusMatch?.[1], match.team_a, match.team_b);
    }
    // Extract MOTM
    const motmRegex = /playersOfTheMatch\\?":\s*\[\s*\{[^}]*?\\?"name\\?":\s*\\?"([^"\\]+)\\?"/;
    const motmMatch = liveHtml.match(motmRegex);
    if (motmMatch) {
      playerOfTheMatch = motmMatch[1];
      console.log(`MOTM: ${playerOfTheMatch}`);
    }
  }

  // Update match with winning team
  const matchUpdate: any = { status: "completed" };
  if (winningTeam) matchUpdate.winning_team = winningTeam;
  await supabase.from("matches").update(matchUpdate).eq("id", matchId);

  // Load alias map
  const aliasMap = new Map<string, string>();
  const { data: aliases } = await supabase.from("player_aliases").select("player_id, alias");
  if (aliases) {
    for (const row of aliases) {
      aliasMap.set(normalizeName(row.alias), row.player_id);
    }
  }

  // Get all players from DB
  const { data: dbPlayers } = await supabase.from("players").select("id, name, team, external_id");
  if (!dbPlayers?.length) return { success: false, error: "No players in database" };

  let matched = 0;
  let winBonusApplied = 0;
  let motmBonusApplied = 0;

  for (const ps of players) {
    const normalizedPs = normalizeName(ps.name);
    let dbPlayer = dbPlayers.find((dp: any) => normalizeName(dp.name) === normalizedPs)
      || dbPlayers.find((dp: any) => normalizeName(dp.name).includes(normalizedPs) || normalizedPs.includes(normalizeName(dp.name)));

    if (!dbPlayer) {
      const aliasPlayerId = aliasMap.get(normalizedPs);
      if (aliasPlayerId) dbPlayer = dbPlayers.find((dp: any) => dp.id === aliasPlayerId);
    }
    if (!dbPlayer) continue;

    let points = calculatePoints(ps);

    // +5 bonus for winning team players
    if (winningTeam && dbPlayer.team) {
      const playerTeam = dbPlayer.team.toLowerCase();
      const winTeam = winningTeam.toLowerCase();
      if (playerTeam === winTeam || playerTeam.includes(winTeam) || winTeam.includes(playerTeam)) {
        points += 5;
        winBonusApplied++;
      }
    }

    // +30 bonus for MOTM
    if (playerOfTheMatch) {
      const motmNorm = normalizeName(playerOfTheMatch);
      if (normalizedPs === motmNorm || normalizedPs.includes(motmNorm) || motmNorm.includes(normalizedPs)) {
        points += 30;
        motmBonusApplied++;
        console.log(`MOTM bonus +30 applied to ${ps.name}`);
      }
    }

    await supabase.from("match_player_points").upsert(
      { match_id: matchId, player_id: dbPlayer.id, points, data_source: "cricbuzz-recalc" },
      { onConflict: "match_id,player_id" }
    );

    // Update global player points
    const { data: allMatchPoints } = await supabase
      .from("match_player_points")
      .select("points")
      .eq("player_id", dbPlayer.id);
    const totalPoints = (allMatchPoints || []).reduce((sum: number, row: any) => sum + (row.points || 0), 0);
    await supabase.from("players").update({ points: totalPoints }).eq("id", dbPlayer.id);

    matched++;
  }

  // Recalculate all user team points
  await recalcUserTeamPoints(supabase, matchId);

  return {
    success: true,
    playersMatched: matched,
    totalPlayers: players.length,
    winningTeam,
    winBonusApplied,
    playerOfTheMatch,
    motmBonusApplied,
  };
}

// ─── Scorecard Parser (same logic as sync-live-scores) ─────────────────────

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

function parseScorecardPlayers(html: string): PlayerStats[] {
  const players: PlayerStats[] = [];

  const batRegex = /\\?"batName\\?":\s*\\?"([^"\\]+)\\?"[^}]*?\\?"runs\\?":\s*(\d+)[^}]*?\\?"balls\\?":\s*(\d+)[^}]*?\\?"fours\\?":\s*(\d+)[^}]*?\\?"sixes\\?":\s*(\d+)/g;
  let bm;
  while ((bm = batRegex.exec(html)) !== null) {
    const name = bm[1];
    if (!name || name === "undefined") continue;

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const outDescRegex = new RegExp(`\\\\?"batName\\\\?":\\s*\\\\?"${escapedName}\\\\?"[^}]*?\\\\?"outDesc\\\\?":\\s*\\\\?"([^"\\\\]*?)\\\\?"`, 'g');
    const outMatch = outDescRegex.exec(html);
    const outDesc = outMatch ? outMatch[1] : "";
    const isOut = outDesc ? !outDesc.includes("not out") && outDesc !== "" && outDesc !== "batting" : false;

    mergePlayer(players, {
      name,
      runs: parseInt(bm[2]) || 0,
      balls: parseInt(bm[3]) || 0,
      fours: parseInt(bm[4]) || 0,
      sixes: parseInt(bm[5]) || 0,
      out: isOut || undefined,
    });

    if (outDesc && !outDesc.includes("not out") && outDesc !== "" && outDesc !== "batting") {
      extractFieldingFromOutDesc(players, outDesc);
    }
  }

  const bowlRegex = /\\?"bowlName\\?":\s*\\?"([^"\\]+)\\?"[^}]*?\\?"overs\\?":\s*([\d.]+)[^}]*?\\?"maidens\\?":\s*(\d+)[^}]*?\\?"runs\\?":\s*(\d+)[^}]*?\\?"wickets\\?":\s*(\d+)/g;
  let bwm;
  while ((bwm = bowlRegex.exec(html)) !== null) {
    const name = bwm[1];
    if (!name || name === "undefined") continue;
    mergePlayer(players, {
      name,
      oversBowled: parseFloat(bwm[2]) || 0,
      maidens: parseInt(bwm[3]) || 0,
      runsConceded: parseInt(bwm[4]) || 0,
      wickets: parseInt(bwm[5]) || 0,
    });
  }

  return players;
}

function extractFieldingFromOutDesc(players: PlayerStats[], outDesc: string) {
  const catchMatch = outDesc.match(/^c\s+(.+?)\s+b\s+/);
  if (catchMatch) {
    const fielder = catchMatch[1].trim();
    if (fielder !== "&" && fielder.length > 1) {
      mergePlayer(players, { name: fielder, catches: 1 });
    }
  }
  const cAndBMatch = outDesc.match(/^c & b\s+(.+)/);
  if (cAndBMatch) {
    const bowler = cAndBMatch[1].trim();
    if (bowler.length > 1) mergePlayer(players, { name: bowler, catches: 1 });
  }
  const stumpMatch = outDesc.match(/^st\s+(.+?)\s+b\s+/);
  if (stumpMatch) {
    const keeper = stumpMatch[1].trim();
    if (keeper.length > 1) mergePlayer(players, { name: keeper, stumpings: 1 });
  }
  const runOutMatch = outDesc.match(/run out\s*\(([^)]+)\)/);
  if (runOutMatch) {
    const fielders = runOutMatch[1].trim().split('/').map(f => f.trim()).filter(f => f.length > 1);
    for (const f of fielders) mergePlayer(players, { name: f, runOuts: 1 });
  }
}

function extractWinningTeam(statusText: string | undefined | null, teamA: string, teamB: string): string | null {
  if (!statusText) return null;
  const s = statusText.toLowerCase();
  if (s.includes("won") || s.includes("beat")) {
    const tA = teamA.toLowerCase();
    const tB = teamB.toLowerCase();
    if (s.includes(tA)) return teamA;
    if (s.includes(tB)) return teamB;
    // Check each word (handles "Islamabad" matching "Islamabad United")
    const winIdx = Math.max(s.indexOf("won"), s.indexOf("beat"));
    for (const word of tA.split(/\s+/)) {
      if (word.length >= 4 && s.includes(word) && s.indexOf(word) < winIdx) return teamA;
    }
    for (const word of tB.split(/\s+/)) {
      if (word.length >= 4 && s.includes(word) && s.indexOf(word) < winIdx) return teamB;
    }
    // PSL keywords
    for (const [key, keywords] of Object.entries(PSL_TEAM_KEYWORDS)) {
      if (tA.includes(key.toLowerCase())) {
        if (keywords.some(kw => s.includes(kw) && s.indexOf(kw) < winIdx)) return teamA;
      }
      if (tB.includes(key.toLowerCase())) {
        if (keywords.some(kw => s.includes(kw) && s.indexOf(kw) < winIdx)) return teamB;
      }
    }
  }
  return null;
}

// ─── Points Calculation (same as sync-live-scores) ─────────────────────────

function calculatePoints(ps: PlayerStats): number {
  let points = 0;
  points += 4; // Starting XI

  const runs = ps.runs || 0;
  const balls = ps.balls || 1;
  const fours = ps.fours || 0;
  const sixes = ps.sixes || 0;

  if (runs > 0 || ps.out !== undefined) {
    points += runs;
    points += fours * 4;
    points += sixes * 6;

    const sr = (runs / Math.max(balls, 1)) * 100;
    if (balls >= 10) {
      if (sr > 170) points += 6;
      else if (sr >= 150) points += 4;
      else if (sr >= 130) points += 2;
      else if (sr < 50) points -= 6;
      else if (sr < 60) points -= 4;
      else if (sr < 70) points -= 2;
    }

    if (runs >= 100) points += 16;
    else if (runs >= 50) points += 8;
    else if (runs >= 25) points += 8;

    if (runs === 0 && ps.out) points -= 2;
  }

  const wickets = ps.wickets || 0;
  const overs = ps.oversBowled || 0;
  const runsConceded = ps.runsConceded || 0;

  if (wickets > 0 || overs > 0) {
    points += wickets * 30;
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

// ─── Utilities ──────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").trim();
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

// ─── Recalculate User Team Points ──────────────────────────────────────────

async function recalcUserTeamPoints(supabase: any, matchId: string) {
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
      if (tp.player_id === ut.captain_id) total += pts * 2;
      else if (tp.player_id === ut.vice_captain_id) total += pts * 1.5;
      else total += pts;
    }

    await supabase.from("user_teams").update({ total_points: Math.round(total) }).eq("id", ut.id);
  }

  // Update profile total points
  const userIds = [...new Set(userTeams.map((ut: any) => ut.user_id))];
  for (const userId of userIds) {
    const { data: allTeams } = await supabase
      .from("user_teams")
      .select("total_points")
      .eq("user_id", userId);
    const totalProfile = (allTeams || []).reduce((s: number, t: any) => s + (t.total_points || 0), 0);
    await supabase.from("profiles").update({ total_points: totalProfile }).eq("user_id", userId);
  }
}
