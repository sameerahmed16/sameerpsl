import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRICAPI_BASE = "https://api.cricapi.com/v1";

// PSL 2026 team IDs from CricAPI
const PSL_SERIES_ID = "d61c8caf-7de4-4a10-997a-2b97e7ee5a7c"; // PSL 2026

const TEAM_ABBRS: Record<string, string> = {
  "Lahore Qalandars": "LQ",
  "Karachi Kings": "KK",
  "Islamabad United": "IU",
  "Peshawar Zalmi": "PZ",
  "Quetta Gladiators": "QG",
  "Multan Sultans": "MS",
};

// Role mapping from CricAPI
function mapRole(role: string): "BAT" | "BOWL" | "AR" | "WK" {
  const r = (role || "").toLowerCase();
  if (r.includes("wk") || r.includes("keeper")) return "WK";
  if (r.includes("all") || r.includes("ar")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  return "BAT";
}

// Default credits by role
function defaultCredits(role: string): number {
  switch (role) {
    case "WK": return 8.5;
    case "AR": return 9.0;
    case "BOWL": return 8.0;
    case "BAT": return 8.5;
    default: return 8.0;
  }
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

    const body = await req.json().catch(() => ({}));
    const matchId = body.match_id; // optional: sync players for specific match

    let totalPlayers = 0;
    let matchesProcessed = 0;

    // Get matches to sync players for
    let matchQuery = supabase
      .from("matches")
      .select("id, external_id, team_a, team_b")
      .not("external_id", "is", null);
    
    if (matchId) {
      matchQuery = matchQuery.eq("id", matchId);
    } else {
      // Only sync upcoming/live matches
      matchQuery = matchQuery.in("status", ["upcoming", "live"]);
    }

    const { data: matches } = await matchQuery;
    if (!matches?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No matches to sync players for", players: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing players
    const { data: existingPlayers } = await supabase
      .from("players")
      .select("id, external_id");
    const playerMap = new Map<string, string>();
    for (const p of existingPlayers || []) {
      if (p.external_id) playerMap.set(p.external_id, p.id);
    }

    for (const match of matches) {
      if (!match.external_id) continue;

      try {
        // Fetch squad/match info from CricAPI
        const data = await fetchViaDb(
          supabase,
          `${CRICAPI_BASE}/match_squad?apikey=${encodeURIComponent(CRICAPI_KEY)}&id=${match.external_id}`
        );

        if (data.status !== "success" || !data.data) continue;

        const squads = data.data;
        const matchPlayerIds: string[] = [];

        for (const squad of squads) {
          const teamName = squad.teamName || squad.name || "";
          
          for (const player of squad.players || []) {
            const extId = player.id;
            if (!extId) continue;

            const role = mapRole(player.role || player.battingStyle || "");
            const credits = defaultCredits(role);
            const imageUrl = player.playerImg && !player.playerImg.includes("default") 
              ? player.playerImg 
              : null;

            if (playerMap.has(extId)) {
              // Update existing player
              const playerId = playerMap.get(extId)!;
              await supabase
                .from("players")
                .update({
                  name: player.name,
                  team: teamName,
                  role,
                  image_url: imageUrl,
                })
                .eq("id", playerId);
              matchPlayerIds.push(playerId);
            } else {
              // Insert new player
              const { data: newPlayer } = await supabase
                .from("players")
                .insert({
                  external_id: extId,
                  name: player.name,
                  team: teamName,
                  role,
                  credits,
                  image_url: imageUrl,
                  points: 0,
                })
                .select("id")
                .single();

              if (newPlayer) {
                playerMap.set(extId, newPlayer.id);
                matchPlayerIds.push(newPlayer.id);
                totalPlayers++;
              }
            }
          }
        }

        // Link players to match
        if (matchPlayerIds.length > 0) {
          // Remove existing links
          await supabase
            .from("match_players")
            .delete()
            .eq("match_id", match.id);

          // Insert new links
          await supabase
            .from("match_players")
            .insert(
              matchPlayerIds.map((pid) => ({
                match_id: match.id,
                player_id: pid,
              }))
            );
        }

        // Update lock_time to match_date if not set
        await supabase
          .from("matches")
          .update({ lock_time: match.external_id ? undefined : new Date().toISOString() })
          .eq("id", match.id)
          .is("lock_time", null);

        matchesProcessed++;
      } catch (matchErr) {
        console.error(`Error syncing players for match ${match.id}:`, matchErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, players: totalPlayers, matches_processed: matchesProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Player sync error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchViaDb(supabase: ReturnType<typeof createClient>, url: string): Promise<any> {
  const { data, error } = await supabase.rpc("http_get_json", { target_url: url });
  if (error) throw new Error(`Database HTTP fetch failed: ${error.message}`);
  return data as any;
}
