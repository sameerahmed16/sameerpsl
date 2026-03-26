import { Badge } from '@/components/ui/badge';
import { Check, X, Minus, Star } from 'lucide-react';
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
}: PlayerCardProps) => {
  const playingIcon = player.is_playing === true 
    ? <Check className="w-3.5 h-3.5 text-primary" />
    : player.is_playing === false 
    ? <X className="w-3.5 h-3.5 text-destructive" />
    : <Minus className="w-3.5 h-3.5 text-muted-foreground" />;

  return (
    <div
      className={cn(
        "gradient-card rounded-lg border p-3 transition-all duration-200 cursor-pointer",
        selected ? "border-primary shadow-glow" : "border-border hover:border-primary/30",
        disabled && !selected && "opacity-40 cursor-not-allowed",
      )}
      onClick={() => !disabled && onSelect?.(player)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-display font-bold text-sm text-foreground shrink-0">
            {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-foreground truncate">{player.name}</p>
            <p className="text-xs text-muted-foreground truncate">{player.team}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {playingIcon}
          <Badge className={cn("text-[10px] px-1.5 py-0.5", roleColors[player.role])}>
            {player.role}
          </Badge>
          <span className="text-sm font-display font-bold text-secondary">{Number(player.credits)}</span>
        </div>
      </div>

      {selected && (
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
