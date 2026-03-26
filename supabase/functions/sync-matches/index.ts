import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

const TEAM_ABBRS: Record<string, string> = {
  "Lahore Qalandars": "LQ",
  "Karachi Kings": "KK",
  "Islamabad United": "IU",
  "Peshawar Zalmi": "PZ",
  "Quetta Gladiators": "QG",
  "Multan Sultans": "MS",
  "Hyderabad Kingsmen": "HK",
  "Rawalpindi Pindiz": "RP",
};

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

    // Fetch all matches across pages, filter for PSL
    const allPslMatches: any[] = [];
    for (let offset = 0; offset <= 75; offset += 25) {
      const data = await fetchViaDb<any>(
        supabase,
        `${CRICAPI_BASE}/matches?apikey=${encodeURIComponent(CRICAPI_KEY)}&offset=${offset}`
      );
      if (data.status !== "success" || !data.data) break;
      const psl = data.data.filter((m: any) =>
        m?.name?.toLowerCase().includes("pakistan super league")
      );
      allPslMatches.push(...psl);
      if (data.data.length < 25) break;
    }

    // Also get currentMatches for live scores
    let currentMap = new Map<string, any>();
    try {
      const curr = await fetchViaDb<any>(
        supabase,
        `${CRICAPI_BASE}/currentMatches?apikey=${encodeURIComponent(CRICAPI_KEY)}&offset=0`
      );
      if (curr.status === "success" && curr.data) {
        for (const m of curr.data) {
          if (m?.id && m?.name?.toLowerCase().includes("pakistan super league")) {
            currentMap.set(m.id, m);
          }
        }
      }
    } catch (_) {}

    // Merge: prefer currentMatches data (has live scores)
    const seenIds = new Set<string>();
    const merged: any[] = [];
    for (const [id, m] of currentMap) {
      seenIds.add(id);
      merged.push(m);
    }
    for (const m of allPslMatches) {
      if (m?.id && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        merged.push(m);
      }
    }

    // Get existing matches by external_id
    const { data: existingMatches } = await supabase
      .from("matches")
      .select("id, external_id")
      .not("external_id", "is", null);

    const existingMap = new Map<string, string>();
    for (const em of existingMatches || []) {
      if (em.external_id) existingMap.set(em.external_id, em.id);
    }

    // Process in batches
    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const match of merged) {
      const externalId = match?.id;
      if (!externalId) continue;

      const teams = (match.teams || []) as string[];
      const teamA = teams[0] || match.teamInfo?.[0]?.name || parseTeamFromName(match.name, 0);
      const teamB = teams[1] || match.teamInfo?.[1]?.name || parseTeamFromName(match.name, 1);
      const teamALogo = match.teamInfo?.[0]?.shortname || TEAM_ABBRS[teamA] || teamA.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
      const teamBLogo = match.teamInfo?.[1]?.shortname || TEAM_ABBRS[teamB] || teamB.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

      let status = "upcoming";
      if (match.matchStarted && !match.matchEnded) status = "live";
      else if (match.matchEnded) status = "completed";
      else if (match.status?.toLowerCase().includes("won") || match.status?.toLowerCase().includes("drawn") || match.status?.toLowerCase().includes("tied")) status = "completed";

      let teamAScore: string | null = null;
      let teamBScore: string | null = null;
      for (const s of match.score || []) {
        const innings = `${s.r || 0}/${s.w || 0} (${s.o || 0})`;
        if (s.inning?.includes(teamA) || s.inning?.includes(teamALogo)) {
          teamAScore = teamAScore ? `${teamAScore} & ${innings}` : innings;
        } else {
          teamBScore = teamBScore ? `${teamBScore} & ${innings}` : innings;
        }
      }

      const matchDate = match.dateTimeGMT || match.date || new Date().toISOString();
      const row = {
        team_a: teamA, team_b: teamB,
        team_a_logo: teamALogo, team_b_logo: teamBLogo,
        match_date: matchDate, venue: match.venue || "TBD",
        status, team_a_score: teamAScore, team_b_score: teamBScore,
      };

      if (existingMap.has(externalId)) {
        toUpdate.push({ id: existingMap.get(externalId)!, data: row });
      } else {
        toInsert.push({ ...row, external_id: externalId });
      }
    }

    // Batch insert
    if (toInsert.length > 0) {
      const { error } = await supabase.from("matches").insert(toInsert);
      if (error) console.error("Batch insert error:", error.message);
    }

    // Batch updates (Supabase doesn't support batch update, do individually but quickly)
    for (const u of toUpdate) {
      await supabase.from("matches").update(u.data).eq("id", u.id);
    }

    return new Response(JSON.stringify({
      success: true,
      matches_synced: toInsert.length + toUpdate.length,
      inserted: toInsert.length,
      updated: toUpdate.length,
    }), {
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
  if (error) throw new Error(`Database HTTP fetch failed: ${error.message}`);
  return data as T;
}

function parseTeamFromName(name: string, index: number): string {
  if (!name) return "TBD";
  const parts = name.split(" vs ");
  if (parts.length >= 2) return parts[index]?.split(",")[0]?.trim() || "TBD";
  return "TBD";
}
