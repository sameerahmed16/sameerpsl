import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { PlayerCard } from '@/components/PlayerCard';
import { MATCHES, PLAYERS, Player, PlayerRole } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const BUDGET = 100;
const MAX_PER_TEAM = 7;
const ROLE_CONSTRAINTS: Record<PlayerRole, [number, number]> = {
  WK: [1, 4],
  BAT: [3, 6],
  AR: [1, 4],
  BOWL: [3, 6],
};

const ROLE_FILTERS: (PlayerRole | 'ALL')[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL'];

const MatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const match = MATCHES.find(m => m.id === id);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'ALL'>('ALL');

  const allPlayers = useMemo(() => {
    if (!match) return [];
    return [
      ...(PLAYERS[match.teamA] || []),
      ...(PLAYERS[match.teamB] || []),
    ];
  }, [match]);

  const filteredPlayers = useMemo(() => {
    if (roleFilter === 'ALL') return allPlayers;
    return allPlayers.filter(p => p.role === roleFilter);
  }, [allPlayers, roleFilter]);

  const selectedPlayers = useMemo(() => allPlayers.filter(p => selected.has(p.id)), [allPlayers, selected]);
  const usedCredits = selectedPlayers.reduce((sum, p) => sum + p.credits, 0);
  const remainingCredits = BUDGET - usedCredits;

  const roleCounts = useMemo(() => {
    const counts: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    selectedPlayers.forEach(p => counts[p.role]++);
    return counts;
  }, [selectedPlayers]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPlayers.forEach(p => { counts[p.team] = (counts[p.team] || 0) + 1; });
    return counts;
  }, [selectedPlayers]);

  if (!match) return <Layout><p className="text-center text-muted-foreground pt-10">Match not found</p></Layout>;

  const canSelect = (player: Player) => {
    if (selected.has(player.id)) return true;
    if (selected.size >= 11) return false;
    if (player.credits > remainingCredits) return false;
    if ((teamCounts[player.team] || 0) >= MAX_PER_TEAM) return false;
    if (roleCounts[player.role] >= ROLE_CONSTRAINTS[player.role][1]) return false;
    return true;
  };

  const handleSelect = (player: Player) => {
    const next = new Set(selected);
    if (next.has(player.id)) {
      next.delete(player.id);
      if (captain === player.id) setCaptain(null);
      if (viceCaptain === player.id) setViceCaptain(null);
    } else {
      if (!canSelect(player)) return;
      next.add(player.id);
    }
    setSelected(next);
  };

  const handleCaptain = (player: Player) => {
    if (viceCaptain === player.id) setViceCaptain(null);
    setCaptain(captain === player.id ? null : player.id);
  };

  const handleViceCaptain = (player: Player) => {
    if (captain === player.id) setCaptain(null);
    setViceCaptain(viceCaptain === player.id ? null : player.id);
  };

  const isValid = selected.size === 11 && captain && viceCaptain &&
    Object.entries(ROLE_CONSTRAINTS).every(([role, [min]]) => roleCounts[role as PlayerRole] >= min);

  const handleSave = () => {
    if (!isValid) {
      toast.error('Complete your team first!');
      return;
    }
    toast.success('Team saved successfully! 🏏');
  };

  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Match header */}
        <div className="gradient-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">{match.venue}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="font-display font-bold text-foreground">{match.teamALogo}</span>
            <span className="text-xs text-muted-foreground">vs</span>
            <span className="font-display font-bold text-foreground">{match.teamBLogo}</span>
          </div>
        </div>

        {/* Budget bar */}
        <div className="gradient-card rounded-lg border border-border p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Players: <span className="text-foreground font-display font-bold">{selected.size}/11</span></span>
            <span className="text-muted-foreground">Credits: <span className={cn("font-display font-bold", remainingCredits < 10 ? "text-destructive" : "text-secondary")}>{remainingCredits.toFixed(1)}</span></span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-primary transition-all duration-300 rounded-full" style={{ width: `${(usedCredits / BUDGET) * 100}%` }} />
          </div>
          <div className="flex gap-2 mt-2">
            {(Object.entries(ROLE_CONSTRAINTS) as [PlayerRole, [number, number]][]).map(([role, [min, max]]) => (
              <Badge key={role} variant="outline" className={cn("text-[10px]", roleCounts[role] >= min ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {role}: {roleCounts[role]}/{min}-{max}
              </Badge>
            ))}
          </div>
        </div>

        {/* Role filter */}
        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {ROLE_FILTERS.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "text-xs px-3 py-1 rounded-full font-display font-semibold transition-colors",
                roleFilter === r ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Players */}
        <div className="space-y-2">
          {filteredPlayers.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={selected.has(player.id)}
              isCaptain={captain === player.id}
              isViceCaptain={viceCaptain === player.id}
              onSelect={handleSelect}
              onCaptain={handleCaptain}
              onViceCaptain={handleViceCaptain}
              disabled={!canSelect(player)}
            />
          ))}
        </div>

        {/* Save button */}
        <div className="sticky bottom-20 z-10">
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="w-full gradient-primary text-primary-foreground font-display font-bold text-base py-6 shadow-glow disabled:opacity-40"
          >
            Save Team ({selected.size}/11)
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default MatchDetail;
