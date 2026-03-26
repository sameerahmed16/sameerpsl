import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const rankStyles: Record<number, string> = {
  1: 'gradient-gold text-secondary-foreground shadow-gold',
  2: 'bg-muted text-foreground',
  3: 'bg-muted text-foreground',
};

const Leaderboard = () => {
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: matches = [] } = useQuery({
    queryKey: ['leaderboard-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, status, match_date')
        .in('status', ['live', 'completed'])
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

  const { data: matchEntries = [], isLoading: matchLoading } = useQuery({
    queryKey: ['leaderboard-match', selectedMatch],
    enabled: !!selectedMatch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_teams')
        .select('total_points, user_id')
        .eq('match_id', selectedMatch!)
        .order('total_points', { ascending: false })
        .limit(50);
      if (error) throw error;

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

  const renderEntries = (entries: { rank: number; username: string; points: number }[], loading: boolean) => {
    if (loading) return <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>;
    if (entries.length === 0) return <p className="text-center text-muted-foreground text-sm py-8">No players yet. Be the first!</p>;

    return (
      <div className="space-y-2">
        {entries.map(entry => (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border p-3 transition-all",
              entry.rank <= 3 ? rankStyles[entry.rank] : "gradient-card"
            )}
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
              {entry.points.toLocaleString()} pts
            </span>
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
              <p className="text-center text-muted-foreground text-sm py-8">No matches played yet.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
                  {matches.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMatch(m.id)}
                      className={cn(
                        "shrink-0 text-xs px-3 py-1.5 rounded-full font-display font-semibold transition-colors border",
                        selectedMatch === m.id
                          ? "gradient-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {m.team_a} vs {m.team_b}
                    </button>
                  ))}
                </div>
                {selectedMatch
                  ? renderEntries(matchEntries, matchLoading)
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
