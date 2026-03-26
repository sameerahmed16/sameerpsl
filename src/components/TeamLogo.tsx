import { cn } from '@/lib/utils';

const TEAM_LOGOS: Record<string, string> = {
  'Lahore Qalandars': 'https://upload.wikimedia.org/wikipedia/en/1/1b/Lahore_Qalandars_Logo.png',
  'LQ': 'https://upload.wikimedia.org/wikipedia/en/1/1b/Lahore_Qalandars_Logo.png',
  'Karachi Kings': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Karachi_Kings_logo.png',
  'KK': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Karachi_Kings_logo.png',
  'Islamabad United': 'https://upload.wikimedia.org/wikipedia/en/5/56/Islamabad_United_Logo.png',
  'IU': 'https://upload.wikimedia.org/wikipedia/en/5/56/Islamabad_United_Logo.png',
  'Peshawar Zalmi': 'https://upload.wikimedia.org/wikipedia/en/8/85/Peshawar_Zalmi_logo.png',
  'PZ': 'https://upload.wikimedia.org/wikipedia/en/8/85/Peshawar_Zalmi_logo.png',
  'Quetta Gladiators': 'https://upload.wikimedia.org/wikipedia/en/4/47/Quetta_Gladiators_Logo.png',
  'QG': 'https://upload.wikimedia.org/wikipedia/en/4/47/Quetta_Gladiators_Logo.png',
  'Multan Sultans': 'https://upload.wikimedia.org/wikipedia/en/5/5e/Multan_Sultans_Logo.png',
  'MS': 'https://upload.wikimedia.org/wikipedia/en/5/5e/Multan_Sultans_Logo.png',
};

const TEAM_COLORS: Record<string, string> = {
  'LQ': 'bg-red-600',
  'Lahore Qalandars': 'bg-red-600',
  'KK': 'bg-blue-700',
  'Karachi Kings': 'bg-blue-700',
  'IU': 'bg-red-700',
  'Islamabad United': 'bg-red-700',
  'PZ': 'bg-yellow-500',
  'Peshawar Zalmi': 'bg-yellow-500',
  'QG': 'bg-purple-700',
  'Quetta Gladiators': 'bg-purple-700',
  'MS': 'bg-cyan-600',
  'Multan Sultans': 'bg-cyan-600',
};

interface TeamLogoProps {
  team: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const TeamLogo = ({ team, size = 'md', className }: TeamLogoProps) => {
  const logoUrl = TEAM_LOGOS[team];
  const abbr = team.length <= 3 ? team : team.split(' ').map(w => w[0]).join('').slice(0, 2);
  const colorClass = TEAM_COLORS[team] || 'bg-muted';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={team}
        className={cn(sizeMap[size], 'object-contain', className)}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = 'none';
          el.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div className={cn(sizeMap[size], 'rounded-full flex items-center justify-center text-white font-display font-bold text-xs', colorClass, className)}>
      {abbr}
    </div>
  );
};

export { TEAM_LOGOS, TEAM_COLORS };
