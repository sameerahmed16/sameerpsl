import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

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
  live: 'gradient-primary text-primary-foreground animate-pulse-glow',
  completed: 'bg-muted text-muted-foreground opacity-70',
};

function TeamLogo({ abbr, teamName }: { abbr: string; teamName: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center font-display font-bold text-lg text-foreground border border-border">
        {abbr}
      </div>
      <span className="text-xs text-muted-foreground text-center max-w-[80px] leading-tight">{teamName}</span>
    </div>
  );
}

export const MatchCard = ({ match }: { match: MatchData }) => {
  const matchDate = new Date(match.match_date);

  return (
    <Link to={`/match/${match.id}`} className="block group">
      <div className="gradient-card rounded-lg border border-border p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-glow">
        <div className="flex items-center justify-between mb-4">
          <Badge className={statusStyles[match.status] || statusStyles.upcoming}>
            {match.status === 'live' && <span className="w-2 h-2 rounded-full bg-primary-foreground mr-1.5 animate-pulse" />}
            {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {format(matchDate, 'MMM d, yyyy')}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <TeamLogo abbr={match.team_a_logo} teamName={match.team_a} />
          
          <div className="flex flex-col items-center gap-1">
            {match.status === 'upcoming' ? (
              <>
                <span className="text-2xl font-display font-bold text-foreground">VS</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(matchDate, 'HH:mm')}
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm font-body font-medium text-foreground">{match.team_a_score}</p>
                <span className="text-xs text-muted-foreground">vs</span>
                <p className="text-sm font-body font-medium text-foreground">{match.team_b_score}</p>
              </div>
            )}
          </div>

          <TeamLogo abbr={match.team_b_logo} teamName={match.team_b} />
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {match.venue}
        </div>
      </div>
    </Link>
  );
};
