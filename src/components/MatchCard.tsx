import { Match } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusStyles = {
  upcoming: 'bg-muted text-muted-foreground',
  live: 'gradient-primary text-primary-foreground animate-pulse-glow',
  completed: 'bg-muted text-muted-foreground opacity-70',
};

const TeamLogo = ({ abbr, teamName }: { abbr: string; teamName: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center font-display font-bold text-lg text-foreground border border-border">
      {abbr}
    </div>
    <span className="text-xs text-muted-foreground text-center max-w-[80px] leading-tight">{teamName}</span>
  </div>
);

export const MatchCard = ({ match }: { match: Match }) => {
  return (
    <Link to={`/match/${match.id}`} className="block group">
      <div className="gradient-card rounded-lg border border-border p-5 hover:border-primary/40 transition-all duration-300 hover:shadow-glow">
        <div className="flex items-center justify-between mb-4">
          <Badge className={statusStyles[match.status]}>
            {match.status === 'live' && <span className="w-2 h-2 rounded-full bg-primary-foreground mr-1.5 animate-pulse" />}
            {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {match.date}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <TeamLogo abbr={match.teamALogo} teamName={match.teamA} />
          
          <div className="flex flex-col items-center gap-1">
            {match.status === 'upcoming' ? (
              <>
                <span className="text-2xl font-display font-bold text-foreground">VS</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {match.time}
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm font-body font-medium text-foreground">{match.teamAScore}</p>
                <span className="text-xs text-muted-foreground">vs</span>
                <p className="text-sm font-body font-medium text-foreground">{match.teamBScore}</p>
              </div>
            )}
          </div>

          <TeamLogo abbr={match.teamBLogo} teamName={match.teamB} />
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {match.venue}
        </div>
      </div>
    </Link>
  );
};
