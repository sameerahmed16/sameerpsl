import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { PlayingXIBadge } from '@/components/PlayingXIBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

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

interface PlayerCardProps {
  player: Player;
  roleColors: Record<PlayerRole, string>;
  selected?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  onSelect?: (player: Player) => void;
  onCaptain?: (player: Player) => void;
  onViceCaptain?: (player: Player) => void;
  disabled?: boolean;
  isLocked?: boolean;
  showPoints?: boolean;
}

export const PlayerCard = ({
  player,
  roleColors,
  selected = false,
  isCaptain = false,
  isViceCaptain = false,
  onSelect,
  onCaptain,
  onViceCaptain,
  disabled = false,
  isLocked = false,
  showPoints = false,
}: PlayerCardProps) => {
  const notInXI = selected && player.is_playing === false;
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div
      className={cn(
        "gradient-card rounded-lg border p-3 transition-all duration-200",
        !isLocked && "cursor-pointer",
        isLocked && "cursor-default",
        selected ? "border-primary shadow-glow" : "border-border hover:border-primary/30",
        notInXI && "border-destructive/50 shadow-none",
        disabled && !selected && "opacity-40 cursor-not-allowed",
      )}
      onClick={() => !disabled && !isLocked && onSelect?.(player)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-10 h-10 shrink-0 border border-border">
            {player.image_url && (
              <AvatarImage src={player.image_url} alt={player.name} className="object-cover" />
            )}
            <AvatarFallback className="bg-muted font-display font-bold text-sm text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-display font-semibold text-sm text-foreground truncate">{player.name}</p>
              {isCaptain && <span className="text-[9px] px-1 py-0.5 rounded gradient-gold text-secondary-foreground font-display font-bold">C</span>}
              {isViceCaptain && <span className="text-[9px] px-1 py-0.5 rounded gradient-primary text-primary-foreground font-display font-bold">VC</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{player.team}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showPoints && (
            <span className="text-sm font-display font-bold text-primary">{player.points}pts</span>
          )}
          <PlayingXIBadge isPlaying={player.is_playing} />
          <Badge className={cn("text-[10px] px-1.5 py-0.5", roleColors[player.role])}>
            {player.role}
          </Badge>
          <span className="text-sm font-display font-bold text-secondary">{Number(player.credits)}</span>
        </div>
      </div>

      {notInXI && !isLocked && (
        <div className="mt-2 px-2 py-1 rounded bg-destructive/10 text-destructive text-[11px] font-display font-semibold text-center">
          ⚠️ Not in Playing XI — will score 0 points
        </div>
      )}

      {selected && !isLocked && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-border">
          <button
            onClick={(e) => { e.stopPropagation(); onCaptain?.(player); }}
            className={cn(
              "flex-1 text-xs py-1 rounded font-display font-semibold transition-colors",
              isCaptain ? "gradient-gold text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className="w-3 h-3 inline mr-1" />C (2x)
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViceCaptain?.(player); }}
            className={cn(
              "flex-1 text-xs py-1 rounded font-display font-semibold transition-colors",
              isViceCaptain ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            VC (1.5x)
          </button>
        </div>
      )}
    </div>
  );
};
