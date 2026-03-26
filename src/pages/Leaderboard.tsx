import { Layout } from '@/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

const rankStyles: Record<number, string> = {
  1: 'gradient-gold text-secondary-foreground shadow-gold',
  2: 'bg-muted text-foreground',
  3: 'bg-muted text-foreground',
};

const Leaderboard = () => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, total_points')
        .order('total_points', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data.map((e, i) => ({ rank: i + 1, username: e.username, points: e.total_points }));
    },
  });

  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <h1 className="font-display font-black text-2xl text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-secondary" /> Leaderboard
        </h1>

        {isLoading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No players yet. Be the first!</p>
        ) : (
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
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
