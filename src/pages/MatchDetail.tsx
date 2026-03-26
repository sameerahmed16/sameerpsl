import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { PlayerCard } from '@/components/PlayerCard';
import { CountdownTimer } from '@/components/CountdownTimer';
import { TeamLogo, getTeamFullName } from '@/components/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Filter, AlertTriangle, Loader2, WifiOff } from 'lucide-react';
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

const BUDGET = 100;
const MAX_PER_TEAM = 7;
const ROLE_CONSTRAINTS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [3, 6],
  AR: [1, 4],
  BOWL: [3, 6],
};
const ROLE_FILTERS: (PlayerRole | 'ALL')[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL'];

const ROLE_COLORS: Record<PlayerRole, string> = {
  BAT: 'bg-secondary text-secondary-foreground',
  BOWL: 'bg-primary text-primary-foreground',
  AR: 'bg-accent text-accent-foreground',
  WK: 'bg-destructive text-destructive-foreground',
};

// Generate a deterministic UUID-like string from player name + team
const generateId = (name: string, team: string): string => {
  const str = `${name}-${team}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(16,19)}-${hex.slice(0,12)}`;
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

  // Fetch match data
  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('id', id!).single();
      if (error) throw error;
      return data as typeof data & { lock_time?: string };
    },
    refetchInterval: 30000,
  });

  // Fetch players for this match
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
  });

  // Try background sync once, but don't block UI
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

  // Determine final player list: DB players or fallback
  const allPlayers = useMemo(() => {
    if (dbPlayers.length > 0) return dbPlayers;
    if (!match) return [];
    const fallbacks = getFallbackPlayers(match.team_a, match.team_b);
    if (fallbacks.length > 0) return fallbacks.map(fallbackToPlayer);
    return [];
  }, [dbPlayers, match]);

  useEffect(() => {
    setUsingFallback(dbPlayers.length === 0 && allPlayers.length > 0);
  }, [dbPlayers.length, allPlayers.length]);

  // Fetch existing user team
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
  });

  // Load existing team into state
  useEffect(() => {
    if (existingTeam) {
      const playerIds = new Set(existingTeam.team_players?.map((tp: any) => tp.player_id) || []);
      setSelected(playerIds);
      setCaptain(existingTeam.captain_id);
      setViceCaptain(existingTeam.vice_captain_id);
    }
  }, [existingTeam]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`match-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['match', id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        queryClient.invalidateQueries({ queryKey: ['match-players', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Determine lock state
  const isLocked = useMemo(() => {
    if (!match) return false;
    if (match.status === 'live' || match.status === 'completed') return true;
    const lockTime = match.lock_time || match.match_date;
    return new Date(lockTime).getTime() <= Date.now();
  }, [match]);

  // Save team mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id || !captain || !viceCaptain) throw new Error('Missing data');
      if (isLocked) throw new Error('Team is locked');

      // If using fallback players, insert them into DB first
      if (usingFallback) {
        const playersToInsert = allPlayers.filter(p => selected.has(p.id));
        for (const p of playersToInsert) {
          await supabase.from('players').upsert({
            id: p.id,
            name: p.name,
            team: p.team,
            role: p.role,
            credits: p.credits,
            points: 0,
          }, { onConflict: 'id' });
          
          await supabase.from('match_players').upsert({
            match_id: id,
            player_id: p.id,
          }, { onConflict: 'match_id,player_id' }).select();
        }
      }

      const { data: team, error: teamError } = await supabase
        .from('user_teams')
        .upsert({
          user_id: user.id,
          match_id: id,
          captain_id: captain,
          vice_captain_id: viceCaptain,
        }, { onConflict: 'user_id,match_id' })
        .select()
        .single();
      if (teamError) throw teamError;

      await supabase.from('team_players').delete().eq('user_team_id', team.id);

      const { error: playersError } = await supabase
        .from('team_players')
        .insert(Array.from(selected).map(playerId => ({
          user_team_id: team.id,
          player_id: playerId,
        })));
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

  const selectedPlayers = useMemo(() => allPlayers.filter(p => selected.has(p.id)), [allPlayers, selected]);
  const usedCredits = selectedPlayers.reduce((sum, p) => sum + Number(p.credits), 0);
  const remainingCredits = BUDGET - usedCredits;

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

        {/* Match Header */}
        <div className="gradient-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-3 text-center">{match.venue}</p>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1 flex-1">
              <TeamLogo team={match.team_a} size="lg" />
              <span className="font-display font-bold text-foreground text-sm text-center">{teamAName}</span>
              {match.team_a_score && <span className="text-xs text-muted-foreground">{match.team_a_score}</span>}
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-xs text-muted-foreground font-display">vs</span>
              <div className="mt-1">
                <CountdownTimer targetDate={match.lock_time || match.match_date} isLocked={isLocked} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <TeamLogo team={match.team_b} size="lg" />
              <span className="font-display font-bold text-foreground text-sm text-center">{teamBName}</span>
              {match.team_b_score && <span className="text-xs text-muted-foreground">{match.team_b_score}</span>}
            </div>
          </div>
        </div>

        {/* Fallback notice */}
        {usingFallback && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground text-xs">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Using estimated squads. Live data will update automatically when available.</span>
          </div>
        )}

        {/* Warnings */}
        {notPlayingCount > 0 && !isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-display">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{notPlayingCount} player(s) in your team not in Playing XI!</span>
          </div>
        )}

        {/* Budget & Constraints */}
        <div className="gradient-card rounded-lg border border-border p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Players: <span className="text-foreground font-display font-bold">{selected.size}/11</span></span>
            <span className="text-muted-foreground">Credits: <span className={cn("font-display font-bold", remainingCredits < 10 ? "text-destructive" : "text-secondary")}>{remainingCredits.toFixed(1)}</span></span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-primary transition-all duration-300 rounded-full" style={{ width: `${(usedCredits / BUDGET) * 100}%` }} />
          </div>
          <div className="flex gap-2 mt-2">
            {(Object.entries(ROLE_CONSTRAINTS) as [PlayerRole, [number, number]][]).map(([role, [min, max]]) => (
              <Badge key={role} variant="outline" className={cn("text-[10px]", roleCounts[role] >= min ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {role}: {roleCounts[role]}/{min}-{max}
              </Badge>
            ))}
          </div>
        </div>

        {/* Role Filter */}
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

        {/* Player List */}
        {isStillLoading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Loading players...</p>
          </div>
        ) : allPlayers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <WifiOff className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              No players available yet. They'll appear once squads are announced.
            </p>
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
                showPoints={match.status === 'live' || match.status === 'completed'}
              />
            ))}
          </div>
        )}

        {/* Preview & Save Buttons */}
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
              {saveMutation.isPending ? 'Saving...' : `Save Team (${selected.size}/11)`}
            </Button>
          </div>
        )}

        {/* Team Preview Overlay */}
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
