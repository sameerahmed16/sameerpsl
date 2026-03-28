import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { PlayerCard } from '@/components/PlayerCard';
import { CountdownTimer } from '@/components/CountdownTimer';
import { TeamLogo, getTeamFullName } from '@/components/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Filter, AlertTriangle, Loader2, WifiOff, Trophy, Users, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getFallbackPlayers, type FallbackPlayer } from '@/data/pslSquads';
import { TeamPreview } from '@/components/TeamPreview';

type PlayerRole = 'BAT' | 'BOWL' | 'AR' | 'WK';

interface Player {
  id: string;
  name: string;
  team: string;
  role: PlayerRole;
  credits: number;
  points: number;
  is_playing: boolean | null;
  image_url?: string | null;
}

const BUDGET_CUTOFF = new Date('2026-03-28T00:00:00Z');
const getBudget = (matchDate?: string) => {
  if (!matchDate) return 100;
  return new Date(matchDate) > BUDGET_CUTOFF ? 90 : 100;
};
const MAX_PER_TEAM = 7;
const ROLE_CONSTRAINTS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [1, 6],
  AR: [1, 4],
  BOWL: [1, 6],
};
const ROLE_FILTERS: (PlayerRole | 'ALL')[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL'];

const ROLE_COLORS: Record<PlayerRole, string> = {
  BAT: 'bg-secondary text-secondary-foreground',
  BOWL: 'bg-primary text-primary-foreground',
  AR: 'bg-accent text-accent-foreground',
  WK: 'bg-destructive text-destructive-foreground',
};

const generateId = (name: string, team: string): string => {
  const str = `${name}-${team}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x12345678, h4 = 0x9abcdef0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  h3 = (h3 ^ (h3 >>> 16)) >>> 0;
  h4 = (h4 ^ (h4 >>> 16)) >>> 0;
  const hex = [
    h1.toString(16).padStart(8, '0'),
    h2.toString(16).padStart(8, '0').slice(0, 4),
    '4' + h2.toString(16).padStart(8, '0').slice(5, 8),
    ((h3 & 0x3fff) | 0x8000).toString(16).padStart(4, '0'),
    h4.toString(16).padStart(8, '0') + h1.toString(16).padStart(8, '0').slice(0, 4),
  ];
  return `${hex[0]}-${hex[1]}-${hex[2]}-${hex[3]}-${hex[4]}`;
};

const fallbackToPlayer = (fp: FallbackPlayer): Player => ({
  id: generateId(fp.name, fp.team),
  name: fp.name,
  team: fp.team,
  role: fp.role,
  credits: fp.credits,
  points: 0,
  is_playing: null,
  image_url: null,
});

// ─── Live Scoreboard Components ─────────────────────────────────────────────

const LiveMyTeam = ({ players, captainId, viceCaptainId }: { players: Player[]; captainId: string | null; viceCaptainId: string | null }) => {
  const totalPoints = useMemo(() => {
    return players.reduce((sum, p) => {
      let pts = p.points;
      if (p.id === captainId) pts *= 2;
      else if (p.id === viceCaptainId) pts *= 1.5;
      return sum + pts;
    }, 0);
  }, [players, captainId, viceCaptainId]);

  const sorted = useMemo(() => {
    const roleOrder: Record<string, number> = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
    return [...players].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  }, [players]);

  return (
    <div className="space-y-3">
      <div className="gradient-card rounded-xl border border-primary/30 p-4 text-center">
        <p className="text-xs text-muted-foreground font-display">Total Fantasy Points</p>
        <p className="text-4xl font-display font-black text-primary mt-1">{Math.round(totalPoints)}</p>
      </div>
      <div className="space-y-1.5">
        {sorted.map(player => {
          const isCaptain = player.id === captainId;
          const isVC = player.id === viceCaptainId;
          const multipliedPts = isCaptain ? player.points * 2 : isVC ? player.points * 1.5 : player.points;
          return (
            <div key={player.id} className="flex items-center gap-3 gradient-card rounded-lg border border-border p-3">
              <Badge className={cn("text-[10px] shrink-0", ROLE_COLORS[player.role])}>{player.role}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-display font-semibold text-sm truncate text-foreground">{player.name}</p>
                  {isCaptain && <Badge className="bg-secondary text-secondary-foreground text-[9px] px-1 py-0">C</Badge>}
                  {isVC && <Badge variant="outline" className="text-[9px] px-1 py-0 border-secondary text-secondary">VC</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground">{player.team}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-bold text-sm text-foreground">{Math.round(multipliedPts)}</p>
                {(isCaptain || isVC) && (
                  <p className="text-[9px] text-muted-foreground">{player.points} × {isCaptain ? '2' : '1.5'}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MatchLeaderboard = ({ matchId }: { matchId: string }) => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['match-leaderboard', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_teams')
        .select('total_points, user_id')
        .eq('match_id', matchId)
        .order('total_points', { ascending: false })
        .limit(50);
      if (error) throw error;

      // Get usernames
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.username]));
      return data.map((d, i) => ({
        rank: i + 1,
        username: profileMap.get(d.user_id) || 'Unknown',
        points: d.total_points,
      }));
    },
    refetchInterval: 15000,
  });

  if (isLoading) return <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>;
  if (entries.length === 0) return <p className="text-center text-muted-foreground text-sm py-8">No teams created yet.</p>;

  return (
    <div className="space-y-1.5">
      {entries.map(entry => (
        <div key={entry.rank} className={cn(
          "flex items-center gap-3 rounded-lg border border-border p-3 transition-all",
          entry.rank === 1 ? "gradient-gold shadow-gold" : "gradient-card"
        )}>
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs shrink-0",
            entry.rank <= 3 ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
          )}>
            {entry.rank}
          </div>
          <p className="flex-1 font-display font-semibold text-sm truncate text-foreground">{entry.username}</p>
          <span className={cn("font-display font-bold text-sm", entry.rank <= 3 ? "text-secondary" : "text-foreground")}>
            {entry.points} pts
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncAttempted = useRef(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'ALL'>('ALL');
  const [usingFallback, setUsingFallback] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as typeof data & { lock_time?: string };
    },
    refetchInterval: (query) => {
      const m = query.state.data;
      return m?.status === 'live' ? 10000 : 30000;
    },
  });

  const { data: dbPlayers = [], isLoading: playersLoading } = useQuery({
    queryKey: ['match-players', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_players')
        .select('player_id, players(*)')
        .eq('match_id', id!);
      if (error) throw error;
      return (data || []).map(mp => mp.players).filter(Boolean) as Player[];
    },
    refetchInterval: match?.status === 'live' ? 10000 : 30000,
  });

  useEffect(() => {
    if (!playersLoading && dbPlayers.length === 0 && !syncAttempted.current && match?.external_id) {
      syncAttempted.current = true;
      const trySync = async () => {
        try {
          await supabase.functions.invoke('sync-players', { body: { match_id: id } });
          queryClient.invalidateQueries({ queryKey: ['match-players', id] });
        } catch (e) {
          console.warn('Background sync failed:', e);
        } finally {
          setSyncDone(true);
        }
      };
      trySync();
    } else if (!playersLoading) {
      setSyncDone(true);
    }
  }, [playersLoading, dbPlayers.length, id, queryClient, match?.external_id]);

  const allPlayers = useMemo(() => {
    if (!match) return dbPlayers.length > 0 ? dbPlayers : [];

    const fallbacks = getFallbackPlayers(match.team_a, match.team_b);
    if (dbPlayers.length === 0) {
      return fallbacks.length > 0 ? fallbacks.map(fallbackToPlayer) : [];
    }

    // Merge: DB players take priority, fallback fills gaps
    const normalize = (n: string) => n.toLowerCase().replace(/[^a-z]/g, '');
    const dbSet = new Set(dbPlayers.map(p => `${normalize(p.name)}|${p.team}`));
    const merged: Player[] = [...dbPlayers];

    for (const fp of fallbacks) {
      const key = `${normalize(fp.name)}|${fp.team}`;
      if (!dbSet.has(key)) {
        merged.push(fallbackToPlayer(fp));
      }
    }

    return merged;
  }, [dbPlayers, match]);

  useEffect(() => {
    setUsingFallback(dbPlayers.length === 0 && allPlayers.length > 0);
  }, [dbPlayers.length, allPlayers.length]);

  const { data: existingTeam } = useQuery({
    queryKey: ['user-team', id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_teams')
        .select('*, team_players(player_id)')
        .eq('user_id', user!.id)
        .eq('match_id', id!)
        .maybeSingle();
      return data;
    },
    refetchInterval: match?.status === 'live' ? 10000 : undefined,
  });

  useEffect(() => {
    if (existingTeam) {
      const playerIds = new Set(existingTeam.team_players?.map((tp: any) => tp.player_id) || []);
      setSelected(playerIds);
      setCaptain(existingTeam.captain_id);
      setViceCaptain(existingTeam.vice_captain_id);
    }
  }, [existingTeam]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['match', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        queryClient.invalidateQueries({ queryKey: ['match-players', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_teams' }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-team', id] });
        queryClient.invalidateQueries({ queryKey: ['match-leaderboard', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const isLocked = useMemo(() => {
    if (!match) return false;
    if (match.status === 'live' || match.status === 'completed') return true;
    const lockTime = match.lock_time || match.match_date;
    return new Date(lockTime).getTime() <= Date.now();
  }, [match]);

  const isLiveOrCompleted = match?.status === 'live' || match?.status === 'completed';
  const hasTeam = !!existingTeam;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id || !captain || !viceCaptain) throw new Error('Missing data');
      if (isLocked) throw new Error('Team is locked');

      // Always upsert players by name+team to get real DB IDs
      const playersToSave = allPlayers.filter(p => selected.has(p.id));
      const idMap = new Map<string, string>(); // old fallback ID -> real DB ID

      for (const p of playersToSave) {
        const { data: upserted } = await supabase.from('players').upsert(
          { name: p.name, team: p.team, role: p.role, credits: p.credits, points: p.points || 0 },
          { onConflict: 'name,team' }
        ).select('id').single();

        if (upserted) {
          idMap.set(p.id, upserted.id);
          // Link to match_players
          await supabase.from('match_players').upsert(
            { match_id: id, player_id: upserted.id },
            { onConflict: 'match_id,player_id' }
          );
        }
      }

      // Remap captain/viceCaptain to real DB IDs
      const realCaptain = idMap.get(captain!) || captain!;
      const realViceCaptain = idMap.get(viceCaptain!) || viceCaptain!;
      const realSelectedIds = Array.from(selected).map(sid => idMap.get(sid) || sid);

      const { data: team, error: teamError } = await supabase
        .from('user_teams')
        .upsert({ user_id: user.id, match_id: id, captain_id: realCaptain, vice_captain_id: realViceCaptain }, { onConflict: 'user_id,match_id' })
        .select()
        .single();
      if (teamError) throw teamError;

      await supabase.from('team_players').delete().eq('user_team_id', team.id);
      const { error: playersError } = await supabase
        .from('team_players')
        .insert(realSelectedIds.map(playerId => ({ user_team_id: team.id, player_id: playerId })));
      if (playersError) throw playersError;
    },
    onSuccess: () => {
      toast.success('Team saved successfully! 🏏');
      queryClient.invalidateQueries({ queryKey: ['user-team', id] });
      setShowPreview(true);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const filteredPlayers = useMemo(() => {
    if (roleFilter === 'ALL') return allPlayers;
    return allPlayers.filter(p => p.role === roleFilter);
  }, [allPlayers, roleFilter]);

  // For live/completed matches with existing teams, always use DB players to avoid ID mismatch
  const selectedPlayers = useMemo(() => {
    if (isLiveOrCompleted && existingTeam && dbPlayers.length > 0) {
      const teamPlayerIds = new Set(existingTeam.team_players?.map((tp: any) => tp.player_id) || []);
      return dbPlayers.filter(p => teamPlayerIds.has(p.id));
    }
    return allPlayers.filter(p => selected.has(p.id));
  }, [allPlayers, selected, dbPlayers, existingTeam, isLiveOrCompleted]);
  const usedCredits = selectedPlayers.reduce((sum, p) => sum + Number(p.credits), 0);
  const matchBudget = getBudget(match?.match_date);
  const remainingCredits = matchBudget - usedCredits;

  const roleCounts = useMemo(() => {
    const counts: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    selectedPlayers.forEach(p => counts[p.role]++);
    return counts;
  }, [selectedPlayers]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPlayers.forEach(p => { counts[p.team] = (counts[p.team] || 0) + 1; });
    return counts;
  }, [selectedPlayers]);

  const notPlayingCount = selectedPlayers.filter(p => p.is_playing === false).length;

  if (!match) return <Layout><p className="text-center text-muted-foreground pt-10">Loading...</p></Layout>;

  const canSelect = (player: Player) => {
    if (isLocked) return false;
    if (selected.has(player.id)) return true;
    if (selected.size >= 11) return false;
    if (Number(player.credits) > remainingCredits) return false;
    if ((teamCounts[player.team] || 0) >= MAX_PER_TEAM) return false;
    if (roleCounts[player.role] >= ROLE_CONSTRAINTS[player.role][1]) return false;
    return true;
  };

  const handleSelect = (player: Player) => {
    if (isLocked) return;
    const next = new Set(selected);
    if (next.has(player.id)) {
      next.delete(player.id);
      if (captain === player.id) setCaptain(null);
      if (viceCaptain === player.id) setViceCaptain(null);
    } else {
      if (!canSelect(player)) return;
      next.add(player.id);
    }
    setSelected(next);
  };

  const handleCaptain = (player: Player) => {
    if (isLocked) return;
    if (viceCaptain === player.id) setViceCaptain(null);
    setCaptain(captain === player.id ? null : player.id);
  };

  const handleViceCaptain = (player: Player) => {
    if (isLocked) return;
    if (captain === player.id) setCaptain(null);
    setViceCaptain(viceCaptain === player.id ? null : player.id);
  };

  const isValid = selected.size === 11 && captain && viceCaptain &&
    Object.entries(ROLE_CONSTRAINTS).every(([role, [min]]) => roleCounts[role as PlayerRole] >= min);

  const teamAName = getTeamFullName(match.team_a);
  const teamBName = getTeamFullName(match.team_b);
  const isStillLoading = playersLoading;

  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Match Header with Live Score */}
        <div className={cn(
          "gradient-card rounded-xl border p-4",
          match.status === 'live' ? "border-destructive/40 shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.3)]" : "border-border"
        )}>
          {match.status === 'live' && (
            <div className="flex justify-center mb-2">
              <Badge className="bg-destructive text-destructive-foreground animate-pulse text-xs">● LIVE</Badge>
            </div>
          )}
          {match.status === 'completed' && (
            <div className="flex flex-col items-center gap-1 mb-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">🏆 Final Score</Badge>
              {match.winning_team && (
                <p className="text-sm font-display font-bold text-primary">{match.winning_team} won!</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-3 text-center">{match.venue}</p>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1 flex-1">
              <TeamLogo team={match.team_a} size="lg" />
              <span className="font-display font-bold text-foreground text-sm text-center">{teamAName}</span>
              {match.team_a_score && (
                <span className={cn("text-sm font-display font-bold", match.status === 'live' ? "text-primary" : "text-foreground")}>{match.team_a_score}</span>
              )}
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-xs text-muted-foreground font-display">vs</span>
              {match.status === 'upcoming' && (
                <div className="mt-1">
                  <CountdownTimer targetDate={match.lock_time || match.match_date} isLocked={isLocked} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <TeamLogo team={match.team_b} size="lg" />
              <span className="font-display font-bold text-foreground text-sm text-center">{teamBName}</span>
              {match.team_b_score && (
                <span className={cn("text-sm font-display font-bold", match.status === 'live' ? "text-primary" : "text-foreground")}>{match.team_b_score}</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── LIVE / COMPLETED VIEW ─── */}
        {isLiveOrCompleted && hasTeam ? (
          <Tabs defaultValue="my-team" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="my-team" className="flex-1 gap-1 text-xs">
                <Star className="w-3.5 h-3.5" /> My Team
              </TabsTrigger>
              <TabsTrigger value="all-players" className="flex-1 gap-1 text-xs">
                <Users className="w-3.5 h-3.5" /> All Players
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex-1 gap-1 text-xs">
                <Trophy className="w-3.5 h-3.5" /> Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-team">
              <LiveMyTeam players={selectedPlayers} captainId={captain} viceCaptainId={viceCaptain} />
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                className="w-full mt-3 font-display font-bold border-primary/30 text-primary"
              >
                👁️ View on Ground
              </Button>
            </TabsContent>

            <TabsContent value="all-players">
              <div className="flex gap-2 items-center mb-3">
                <Filter className="w-4 h-4 text-muted-foreground" />
                {ROLE_FILTERS.map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-full font-display font-semibold transition-colors",
                      roleFilter === r ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredPlayers.map(player => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    roleColors={ROLE_COLORS}
                    selected={selected.has(player.id)}
                    isCaptain={captain === player.id}
                    isViceCaptain={viceCaptain === player.id}
                    onSelect={() => {}}
                    onCaptain={() => {}}
                    onViceCaptain={() => {}}
                    disabled={true}
                    isLocked={true}
                    showPoints={true}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="leaderboard">
              <MatchLeaderboard matchId={id!} />
            </TabsContent>
          </Tabs>
        ) : isLiveOrCompleted && !hasTeam ? (
          /* Live/completed but no team created */
          <div className="text-center py-8 space-y-3">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
            <p className="text-muted-foreground text-sm font-display font-semibold">No team created for this match</p>
            <p className="text-muted-foreground/70 text-xs">Teams must be created before the match starts. You can still view player stats and the leaderboard below.</p>
            <Tabs defaultValue="leaderboard" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="all-players" className="flex-1 gap-1 text-xs">
                  <Users className="w-3.5 h-3.5" /> All Players
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="flex-1 gap-1 text-xs">
                  <Trophy className="w-3.5 h-3.5" /> Leaderboard
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all-players">
                <div className="space-y-2">
                  {allPlayers.map(player => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      roleColors={ROLE_COLORS}
                      selected={false}
                      isCaptain={false}
                      isViceCaptain={false}
                      onSelect={() => {}}
                      onCaptain={() => {}}
                      onViceCaptain={() => {}}
                      disabled={true}
                      isLocked={true}
                      showPoints={true}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="leaderboard">
                <MatchLeaderboard matchId={id!} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* ─── UPCOMING / TEAM SELECTION VIEW ─── */
          <>
            {usingFallback && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-xs">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Using estimated squads. Live data will update automatically when available.</span>
              </div>
            )}

            {notPlayingCount > 0 && !isLocked && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-display">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{notPlayingCount} player(s) in your team not in Playing XI!</span>
              </div>
            )}

            <div className="gradient-card rounded-lg border border-border p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Players: <span className="text-foreground font-display font-bold">{selected.size}/11</span></span>
                <span className="text-muted-foreground">Credits: <span className={cn("font-display font-bold", remainingCredits < 10 ? "text-destructive" : "text-secondary")}>{remainingCredits.toFixed(1)}</span></span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-primary transition-all duration-300 rounded-full" style={{ width: `${(usedCredits / matchBudget) * 100}%` }} />
              </div>
              <div className="flex gap-2 mt-2">
                {(Object.entries(ROLE_CONSTRAINTS) as [PlayerRole, [number, number]][]).map(([role, [min, max]]) => (
                  <Badge key={role} variant="outline" className={cn("text-[10px]", roleCounts[role] >= min ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                    {role}: {roleCounts[role]}/{min}-{max}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {ROLE_FILTERS.map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full font-display font-semibold transition-colors",
                    roleFilter === r ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            {isStillLoading ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm">Loading players...</p>
              </div>
            ) : allPlayers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <WifiOff className="w-8 h-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">No players available yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPlayers.map(player => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    roleColors={ROLE_COLORS}
                    selected={selected.has(player.id)}
                    isCaptain={captain === player.id}
                    isViceCaptain={viceCaptain === player.id}
                    onSelect={handleSelect}
                    onCaptain={handleCaptain}
                    onViceCaptain={handleViceCaptain}
                    disabled={!canSelect(player)}
                    isLocked={isLocked}
                    showPoints={false}
                  />
                ))}
              </div>
            )}

            {existingTeam && !isLocked && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-display font-semibold">
                <span className="text-base">✅</span>
                <span>Team saved! You can still make changes before the match locks.</span>
              </div>
            )}

            {!isLocked && (
              <div className="sticky bottom-20 z-10 space-y-2">
                {isValid && (
                  <Button
                    onClick={() => setShowPreview(true)}
                    variant="outline"
                    className="w-full font-display font-bold text-base py-5 border-primary/30 text-primary"
                  >
                    👁️ Preview Team
                  </Button>
                )}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!isValid || saveMutation.isPending}
                  className="w-full gradient-primary text-primary-foreground font-display font-bold text-base py-6 shadow-glow disabled:opacity-40"
                >
                  {saveMutation.isPending ? 'Saving...' : existingTeam ? `Update Team (${selected.size}/11)` : `Save Team (${selected.size}/11)`}
                </Button>
              </div>
            )}
          </>
        )}

        {showPreview && (
          <TeamPreview
            players={selectedPlayers}
            captainId={captain}
            viceCaptainId={viceCaptain}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </Layout>
  );
};

export default MatchDetail;
