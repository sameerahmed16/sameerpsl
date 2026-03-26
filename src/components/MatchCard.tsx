import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { TeamLogo } from '@/components/TeamLogo';
import { cn } from '@/lib/utils';

interface MatchData {
  id: string;
  team_a: string;
  team_b: string;
  team_a_logo: string;
  team_b_logo: string;
  match_date: string;
  venue: string;
  status: string;
  team_a_score: string | null;
  team_b_score: string | null;
}

const statusStyles: Record<string, string> = {
  upcoming: 'bg-muted text-muted-foreground',
  live: 'bg-destructive text-destructive-foreground animate-pulse',
  completed: 'bg-muted text-muted-foreground opacity-70',
};

export const MatchCard = ({ match }: { match: MatchData }) => {
  const matchDate = new Date(match.match_date);
  const isLive = match.status === 'live';

  return (
    <Link to={`/match/${match.id}`} className="block group">
      <div className={cn(
        "gradient-card rounded-lg border p-5 transition-all duration-300 hover:shadow-glow",
        isLive ? "border-destructive/40 shadow-[0_0_15px_-3px_hsl(var(--destructive)/0.3)]" : "border-border hover:border-primary/40"
      )}>
        <div className="flex items-center justify-between mb-4">
          <Badge className={statusStyles[match.status] || statusStyles.upcoming}>
            {isLive && <span className="w-2 h-2 rounded-full bg-destructive-foreground mr-1.5" />}
            {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {format(matchDate, 'MMM d, yyyy')}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo team={match.team_a} size="md" />
            <span className="text-xs text-muted-foreground text-center max-w-[80px] leading-tight font-display font-bold">{match.team_a_logo}</span>
          </div>
          
          <div className="flex flex-col items-center gap-1 px-2">
            {match.status === 'upcoming' ? (
              <>
                <span className="text-2xl font-display font-bold text-foreground">VS</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(matchDate, 'HH:mm')}
                </div>
              </>
            ) : (
              <div className="text-center space-y-1">
                <p className={cn("text-sm font-display font-bold", isLive && "text-primary")}>{match.team_a_score || '-'}</p>
                <span className="text-[10px] text-muted-foreground font-display">vs</span>
                <p className={cn("text-sm font-display font-bold", isLive && "text-primary")}>{match.team_b_score || '-'}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo team={match.team_b} size="md" />
            <span className="text-xs text-muted-foreground text-center max-w-[80px] leading-tight font-display font-bold">{match.team_b_logo}</span>
          </div>
        </div>

        {isLive && (
          <div className="mt-3 pt-3 border-t border-border/50 text-center">
            <span className="text-xs font-display font-semibold text-destructive animate-pulse">● LIVE NOW</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {match.venue}
        </div>
      </div>
    </Link>
  );
};
