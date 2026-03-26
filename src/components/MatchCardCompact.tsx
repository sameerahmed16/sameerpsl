import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, ChevronRight } from 'lucide-react';
import { TeamLogo, getTeamFullName, TEAM_ABBR } from '@/components/TeamLogo';
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

export const MatchCardCompact = ({ match }: { match: MatchData }) => {
  const matchDate = new Date(match.match_date);
  const abbrA = TEAM_ABBR[match.team_a] || match.team_a.slice(0, 2).toUpperCase();
  const abbrB = TEAM_ABBR[match.team_b] || match.team_b.slice(0, 2).toUpperCase();

  return (
    <Link to={`/match/${match.id}`} className="block group">
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 transition-all hover:border-primary/30 hover:bg-card">
        {/* Teams */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo team={match.team_a} size="sm" />
          <span className="font-display font-bold text-xs text-foreground">{abbrA}</span>
          <span className="text-[10px] text-muted-foreground font-display">vs</span>
          <span className="font-display font-bold text-xs text-foreground">{abbrB}</span>
          <TeamLogo team={match.team_b} size="sm" />
        </div>

        {/* Date */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <Calendar className="w-3 h-3" />
          {format(matchDate, 'MMM d, HH:mm')}
        </div>

        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
      </div>
    </Link>
  );
};
