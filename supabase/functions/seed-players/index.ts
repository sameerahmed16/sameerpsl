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
    if (!CRICAPI_KEY) throw new Error("CRICAPI_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all matches to fetch squads for
    const { data: matches } = await supabase
      .from("matches")
      .select("id, external_id, team_a, team_b")
      .not("external_id", "is", null);

    if (!matches?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No matches with external IDs", seeded: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSeeded = 0;
    const processedExternalIds = new Set<string>();

    for (const match of matches) {
      if (!match.external_id || processedExternalIds.has(match.external_id)) continue;
      processedExternalIds.add(match.external_id);

      try {
        const data = await apiFetch(
          `${CRICAPI_BASE}/match_squad?apikey=${encodeURIComponent(CRICAPI_KEY)}&id=${match.external_id}`,
          supabase
        );

        if (data?.status !== "success" || !data?.data) continue;

        for (const squad of data.data) {
          const teamName = squad.teamName || "";
          for (const player of squad.players || []) {
            if (!player.id || !player.name) continue;

            const role = mapRole(player.role || player.battingStyle || "");
            const credits = assignCredits(player.name);

            const { error } = await supabase.from("players").upsert(
              {
                name: player.name,
                team: abbreviateTeam(teamName),
                role,
                credits,
                external_id: player.id,
                image_url: player.playerImg || null,
              },
              { onConflict: "name,team" }
            );

            if (!error) {
              // Also link to match_players
              const { data: dbPlayer } = await supabase
                .from("players")
                .select("id")
                .eq("name", player.name)
                .eq("team", abbreviateTeam(teamName))
                .maybeSingle();

              if (dbPlayer) {
                await supabase.from("match_players").upsert(
                  { match_id: match.id, player_id: dbPlayer.id },
                  { onConflict: "match_id,player_id" }
                );
                totalSeeded++;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error seeding for match ${match.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, seeded: totalSeeded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function apiFetch(url: string, supabase?: any): Promise<any> {
  // Try direct fetch first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      console.log("Direct fetch succeeded");
      return resp.json();
    }
  } catch (e) {
    console.log("Direct fetch failed, trying RPC fallback:", e);
  }

  // Try http_get_json RPC
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("http_get_json", { target_url: url });
      if (!error && data) {
        console.log("RPC fallback succeeded");
        return data;
      }
    } catch (e) {
      console.log("RPC fallback also failed:", e);
    }
  }

  throw new Error("All fetch methods failed");
}

function mapRole(role: string): "BAT" | "BOWL" | "AR" | "WK" {
  const r = role.toLowerCase();
  if (r.includes("wk") || r.includes("keeper")) return "WK";
  if (r.includes("allrounder") || r.includes("all-rounder")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  return "BAT";
}

const starCredits: Record<string, number> = {
  "Mohammad Rizwan": 10.5, "Babar Azam": 10.5, "Shaheen Afridi": 10,
  "David Warner": 10, "Shadab Khan": 9.5, "Naseem Shah": 9.5,
  "Fakhar Zaman": 9.5, "Haris Rauf": 9, "Marnus Labuschagne": 9.5,
  "Steven Smith": 9.5, "Moeen Ali": 9, "Devon Conway": 9,
  "Saim Ayub": 9, "Saud Shakeel": 9, "Rilee Rossouw": 9,
};

function assignCredits(name: string): number {
  return starCredits[name] || 7;
}

function abbreviateTeam(teamName: string): string {
  const map: Record<string, string> = {
    "Islamabad United": "ISL",
    "Karachi Kings": "KAR",
    "Lahore Qalandars": "LAH",
    "Multan Sultans": "MUL",
    "Peshawar Zalmi": "PES",
    "Quetta Gladiators": "QUE",
  };
  for (const [full, abbr] of Object.entries(map)) {
    if (teamName.includes(full) || teamName.toLowerCase().includes(full.toLowerCase())) return abbr;
  }
  // Fallback: first 3 chars uppercase
  return teamName.slice(0, 3).toUpperCase();
}
