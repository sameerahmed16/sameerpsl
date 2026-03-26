import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, ChevronDown, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const rankStyles: Record<number, string> = {
  1: 'gradient-gold text-secondary-foreground shadow-gold',
  2: 'bg-muted text-foreground',
  3: 'bg-muted text-foreground',
};

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

  const { data: matches = [] } = useQuery({
    queryKey: ['leaderboard-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, status, match_date')
        .in('status', ['upcoming', 'live', 'completed'])
        .order('match_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

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

  const selectedMatchStatus = matches.find(m => m.id === selectedMatch)?.status;

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

  // Fetch squad for expanded entry
  const { data: expandedSquad = [] } = useQuery({
    queryKey: ['squad', expandedEntry],
    enabled: !!expandedEntry,
    queryFn: async () => {
      const { data: tp, error } = await supabase
        .from('team_players')
        .select('player_id, players(name, role, team, credits)')
        .eq('user_team_id', expandedEntry!);
      if (error) throw error;

      // Fetch match points if live/completed
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

  const renderSquad = (entry: LeaderboardEntry) => {
    if (expandedEntry !== entry.userTeamId || expandedSquad.length === 0) return null;
    return (
      <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
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
                "flex items-center gap-3 rounded-lg border border-border p-3 transition-all",
                entry.rank <= 3 ? rankStyles[entry.rank] : "gradient-card",
                showSquad && "cursor-pointer hover:border-primary/40"
              )}
              onClick={() => showSquad && toggleExpand(entry.userTeamId)}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-sm shrink-0",
                entry.rank <= 3 ? "" : "bg-muted text-muted-foreground"
              )}>
                {entry.rank <= 3 ? <Medal className="w-5 h-5" /> : entry.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm truncate">{entry.username}</p>
              </div>
              <span className={cn("font-display font-bold text-sm", entry.rank <= 3 ? "" : "text-secondary")}>
                {isUpcoming ? 'Entered' : `${entry.points.toLocaleString()} pts`}
              </span>
              {showSquad && (
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  expandedEntry === entry.userTeamId && "rotate-180"
                )} />
              )}
            </div>
            {showSquad && renderSquad(entry)}
          </div>
        ))}
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
              <p className="text-center text-muted-foreground text-sm py-8">No matches yet.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
                  {matches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedMatch(m.id); setExpandedEntry(null); }}
                      className={cn(
                        "shrink-0 text-xs px-3 py-1.5 rounded-full font-display font-semibold transition-colors border flex items-center gap-1.5",
                        selectedMatch === m.id
                          ? "gradient-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {m.team_a} vs {m.team_b}
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase", statusColors[m.status] || 'bg-muted')}>
                        {m.status === 'live' ? '🔴 Live' : m.status}
                      </span>
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
