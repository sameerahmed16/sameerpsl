import { Layout } from '@/components/Layout';
import { LEADERBOARD } from '@/data/mockData';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

const rankStyles: Record<number, string> = {
  1: 'gradient-gold text-secondary-foreground shadow-gold',
  2: 'bg-muted text-foreground',
  3: 'bg-muted text-foreground',
};

const Leaderboard = () => {
  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <h1 className="font-display font-black text-2xl text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-secondary" /> Leaderboard
        </h1>

        <div className="space-y-2">
          {LEADERBOARD.map(entry => (
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
      </div>
    </Layout>
  );
};

export default Leaderboard;
