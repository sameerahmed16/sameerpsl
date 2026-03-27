import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, ChevronDown, Users, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format, addHours, subHours, isAfter, isBefore } from 'date-fns';
import { TeamLogo } from '@/components/TeamLogo';

const statusColors: Record<string, string> = {
  upcoming: 'bg-accent text-accent-foreground',
  live: 'bg-destructive text-destructive-foreground',
  completed: 'bg-muted text-muted-foreground',
};

type SquadPlayer = {
  player_id: string;
  name: string;
  role: string;
  team: string;
  credits: number;
  points?: number;
};

type LeaderboardEntry = {
  rank: number;
  username: string;
  points: number;
  userTeamId?: string;
  captainId?: string;
  viceCaptainId?: string;
};

const Leaderboard = () => {
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_teams' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leaderboard-overall'] });
        if (selectedMatch) {
          queryClient.invalidateQueries({ queryKey: ['leaderboard-match', selectedMatch] });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leaderboard-overall'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, selectedMatch]);

  const { data: allMatches = [] } = useQuery({
    queryKey: ['leaderboard-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, status, match_date, winning_team')
        .in('status', ['upcoming', 'live', 'completed'])
        .order('match_date', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Filter: upcoming within next 48h, live always, completed within last 24h
  const now = new Date();
  const matches = allMatches.filter(m => {
    const d = new Date(m.match_date);
    if (m.status === 'live') return true;
    if (m.status === 'upcoming') return isBefore(d, addHours(now, 48));
    if (m.status === 'completed') return isAfter(d, subHours(now, 24));
    return false;
  });

  // Auto-select first match
  useEffect(() => {
    if (matches.length > 0 && !selectedMatch) {
      setSelectedMatch(matches[0].id);
    }
  }, [matches, selectedMatch]);

  const { data: overallEntries = [], isLoading: overallLoading } = useQuery({
    queryKey: ['leaderboard-overall'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, total_points')
        .order('total_points', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map((e, i) => ({ rank: i + 1, username: e.username, points: e.total_points }));
    },
  });

  const selectedMatchData = matches.find(m => m.id === selectedMatch);
  const selectedMatchStatus = selectedMatchData?.status;

  const { data: matchEntries = [], isLoading: matchLoading } = useQuery({
    queryKey: ['leaderboard-match', selectedMatch],
    enabled: !!selectedMatch,
    queryFn: async () => {
      const isUpcoming = selectedMatchStatus === 'upcoming';
      const { data, error } = await supabase
        .from('user_teams')
        .select('id, total_points, user_id, captain_id, vice_captain_id, created_at')
        .eq('match_id', selectedMatch!)
        .order(isUpcoming ? 'created_at' : 'total_points', { ascending: isUpcoming })
        .limit(50);
      if (error) throw error;

      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.username]));
      return data.map((d, i): LeaderboardEntry => ({
        rank: i + 1,
        username: profileMap.get(d.user_id) || 'Unknown',
        points: d.total_points,
        userTeamId: d.id,
        captainId: d.captain_id,
        viceCaptainId: d.vice_captain_id,
      }));
    },
    refetchInterval: 15000,
  });

  const { data: expandedSquad = [] } = useQuery({
    queryKey: ['squad', expandedEntry],
    enabled: !!expandedEntry,
    queryFn: async () => {
      const { data: tp, error } = await supabase
        .from('team_players')
        .select('player_id, players(name, role, team, credits)')
        .eq('user_team_id', expandedEntry!);
      if (error) throw error;

      let pointsMap = new Map<string, number>();
      if (selectedMatch && selectedMatchStatus !== 'upcoming') {
        const playerIds = (tp || []).map(t => t.player_id);
        const { data: mpp } = await supabase
          .from('match_player_points')
          .select('player_id, points')
          .eq('match_id', selectedMatch)
          .in('player_id', playerIds);
        pointsMap = new Map((mpp || []).map(p => [p.player_id, p.points]));
      }

      return (tp || []).map(t => {
        const p = t.players as any;
        return {
          player_id: t.player_id,
          name: p?.name || 'Unknown',
          role: p?.role || 'BAT',
          team: p?.team || '',
          credits: p?.credits || 0,
          points: pointsMap.get(t.player_id),
        } as SquadPlayer;
      });
    },
  });

  const toggleExpand = (teamId: string | undefined) => {
    if (!teamId) return;
    setExpandedEntry(prev => prev === teamId ? null : teamId);
  };

  const roleColors: Record<string, string> = {
    BAT: 'bg-primary/20 text-primary border-primary/30',
    BOWL: 'bg-secondary/20 text-secondary border-secondary/30',
    AR: 'bg-accent/20 text-accent-foreground border-accent/30',
    WK: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-500/40';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300/15 to-gray-400/5 border-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/15 to-orange-500/5 border-amber-600/30';
    return 'gradient-card';
  };

  const renderSquad = (entry: LeaderboardEntry) => {
    if (expandedEntry !== entry.userTeamId || expandedSquad.length === 0) return null;
    return (
      <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 animate-in slide-in-from-top-2 duration-200">
        <p className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          <Users className="w-3 h-3 inline mr-1" />Squad ({expandedSquad.length} players)
        </p>
        {expandedSquad.map(p => (
          <div key={p.player_id} className="flex items-center gap-2 text-xs">
            <Badge className={cn("text-[9px] px-1 py-0", roleColors[p.role] || 'bg-muted text-muted-foreground')}>
              {p.role}
            </Badge>
            <span className="font-display font-semibold text-foreground flex-1 truncate">
              {p.name}
              {entry.captainId === p.player_id && (
                <span className="ml-1 text-[9px] px-1 py-0.5 rounded gradient-gold text-secondary-foreground font-bold">C</span>
              )}
              {entry.viceCaptainId === p.player_id && (
                <span className="ml-1 text-[9px] px-1 py-0.5 rounded gradient-primary text-primary-foreground font-bold">VC</span>
              )}
            </span>
            <span className="text-muted-foreground">{p.team}</span>
            {p.points !== undefined && (
              <span className="font-display font-bold text-primary">{p.points}pts</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderEntries = (entries: LeaderboardEntry[], loading: boolean, showSquad = false) => {
    if (loading) return <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>;
    if (entries.length === 0) return <p className="text-center text-muted-foreground text-sm py-8">No players yet. Be the first!</p>;

    const isUpcoming = selectedMatchStatus === 'upcoming';

    return (
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={`${entry.rank}-${entry.userTeamId || entry.username}`}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 transition-all",
                getRankStyle(entry.rank),
                showSquad && "cursor-pointer hover:border-primary/40"
              )}
              onClick={() => showSquad && toggleExpand(entry.userTeamId)}
            >
              {/* Rank */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm shrink-0",
                entry.rank > 3 && "bg-muted text-muted-foreground"
              )}>
                {getRankIcon(entry.rank) || entry.rank}
              </div>

              {/* Avatar + Name */}
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                {getInitials(entry.username)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm truncate">{entry.username}</p>
              </div>

              {/* Points */}
              <span className={cn("font-display font-bold text-sm", entry.rank <= 3 ? "text-foreground" : "text-secondary")}>
                {showSquad && isUpcoming ? 'Entered' : `${entry.points.toLocaleString()} pts`}
              </span>

              {showSquad && (
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  expandedEntry === entry.userTeamId && "rotate-180"
                )} />
              )}
            </div>
            {showSquad && renderSquad(entry)}
          </div>
        ))}
        <p className="text-center text-muted-foreground text-[11px] pt-2">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <h1 className="font-display font-black text-2xl text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-secondary" /> Leaderboard
        </h1>

        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="overall" className="flex-1 text-xs">Overall</TabsTrigger>
            <TabsTrigger value="match" className="flex-1 text-xs">Per Match</TabsTrigger>
          </TabsList>

          <TabsContent value="overall">
            {renderEntries(overallEntries, overallLoading)}
          </TabsContent>

          <TabsContent value="match">
            {matches.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No matches in the next 48 hours.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
                  {matches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedMatch(m.id); setExpandedEntry(null); }}
                      className={cn(
                        "shrink-0 rounded-xl border p-3 text-left transition-all min-w-[140px]",
                        selectedMatch === m.id
                          ? "gradient-primary text-primary-foreground border-primary shadow-lg"
                          : "bg-card text-card-foreground border-border hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <TeamLogo team={m.team_a} size="sm" />
                        <span className="text-[10px] font-bold opacity-60">vs</span>
                        <TeamLogo team={m.team_b} size="sm" />
                      </div>
                      <p className="text-xs font-display font-bold truncate">{m.team_a} vs {m.team_b}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] opacity-70">
                          {format(new Date(m.match_date), 'MMM d, h:mm a')}
                        </span>
                        <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase", statusColors[m.status] || 'bg-muted')}>
                          {m.status === 'live' ? '🔴 Live' : m.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedMatch
                  ? renderEntries(matchEntries, matchLoading, true)
                  : <p className="text-center text-muted-foreground text-sm py-8">Select a match above</p>
                }
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Leaderboard;
