import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayingXIBadgeProps {
  isPlaying: boolean | null;
  size?: 'sm' | 'md';
}

export const PlayingXIBadge = ({ isPlaying, size = 'sm' }: PlayingXIBadgeProps) => {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (isPlaying === true) {
    return (
      <div className={cn("flex items-center gap-1", size === 'md' && "px-2 py-0.5 rounded-full bg-primary/10")}>
        <Check className={cn(iconSize, "text-primary")} />
        {size === 'md' && <span className="text-[10px] text-primary font-display font-semibold">Playing</span>}
      </div>
    );
  }

  if (isPlaying === false) {
    return (
      <div className={cn("flex items-center gap-1", size === 'md' && "px-2 py-0.5 rounded-full bg-destructive/10")}>
        <X className={cn(iconSize, "text-destructive")} />
        {size === 'md' && <span className="text-[10px] text-destructive font-display font-semibold">Not Playing</span>}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", size === 'md' && "px-2 py-0.5 rounded-full bg-muted")}>
      <Minus className={cn(iconSize, "text-muted-foreground")} />
      {size === 'md' && <span className="text-[10px] text-muted-foreground font-display font-semibold">TBA</span>}
    </div>
  );
};
