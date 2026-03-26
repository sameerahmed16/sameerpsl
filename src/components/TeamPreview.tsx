import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/components/TeamLogo';

interface Player {
  id: string;
  name: string;
  team: string;
  role: 'BAT' | 'BOWL' | 'AR' | 'WK';
  credits: number;
  points: number;
}

interface TeamPreviewProps {
  players: Player[];
  captainId: string | null;
  viceCaptainId: string | null;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const getTeamGradient = (team: string) => {
  const colors = TEAM_COLORS[team];
  if (!colors) return 'from-gray-500 to-gray-700';
  return colors;
};

export const TeamPreview = ({ players, captainId, viceCaptainId, onClose }: TeamPreviewProps) => {
  const wk = players.filter(p => p.role === 'WK');
  const bat = players.filter(p => p.role === 'BAT');
  const ar = players.filter(p => p.role === 'AR');
  const bowl = players.filter(p => p.role === 'BOWL');

  const roleRows: { label: string; players: Player[] }[] = [
    { label: 'WICKET-KEEPER', players: wk },
    { label: 'BATSMEN', players: bat },
    { label: 'ALL-ROUNDERS', players: ar },
    { label: 'BOWLERS', players: bowl },
  ].filter(r => r.players.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-auto h-[90vh] max-h-[700px] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cricket ground */}
        <div className="flex-1 relative rounded-[50%] overflow-hidden mx-4 my-4"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(142 40% 35%) 0%, hsl(142 50% 25%) 40%, hsl(142 55% 18%) 100%)',
            border: '4px solid hsl(142 30% 40%)',
          }}
        >
          {/* Pitch in center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-20 rounded-sm"
            style={{ background: 'hsl(35 50% 55%)' }}
          />

          {/* Inner circle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-white/20" />

          {/* Player rows */}
          <div className="absolute inset-0 flex flex-col justify-around py-6 px-2">
            {roleRows.map(({ label, players: rowPlayers }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-display font-bold text-white/50 tracking-widest uppercase">
                  {label}
                </span>
                <div className="flex justify-center gap-3 flex-wrap">
                  {rowPlayers.map(player => {
                    const isCaptain = player.id === captainId;
                    const isVice = player.id === viceCaptainId;
                    const gradient = getTeamGradient(player.team);

                    return (
                      <div key={player.id} className="flex flex-col items-center gap-0.5 relative">
                        {/* Badge */}
                        {(isCaptain || isVice) && (
                          <div className={cn(
                            "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold z-10",
                            isCaptain ? "bg-yellow-400 text-black" : "bg-purple-500 text-white"
                          )}>
                            {isCaptain ? 'C' : 'VC'}
                          </div>
                        )}
                        {/* Avatar */}
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br shadow-lg border-2 border-white/30",
                          gradient
                        )}>
                          {getInitials(player.name)}
                        </div>
                        {/* Name */}
                        <span className="text-[9px] text-white font-medium text-center max-w-[60px] truncate leading-tight bg-black/40 px-1.5 py-0.5 rounded">
                          {player.name.split(' ').pop()}
                        </span>
                        {/* Points */}
                        <span className="text-[8px] text-white/60">
                          {player.credits} Cr
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
