import { cn } from '@/lib/utils';

import lqLogo from '@/assets/logos/lahore-qalandars.png';
import kkLogo from '@/assets/logos/karachi-kings.png';
import iuLogo from '@/assets/logos/islamabad-united.png';
import pzLogo from '@/assets/logos/peshawar-zalmi.png';
import qgLogo from '@/assets/logos/quetta-gladiators.png';
import msLogo from '@/assets/logos/multan-sultans.png';
import hkLogo from '@/assets/logos/hyderabad-kingsmen.png';
import rpLogo from '@/assets/logos/rawalpindi-pindiz.png';

const TEAM_ABBR: Record<string, string> = {
  'Lahore Qalandars': 'LQ', 'LQ': 'LQ',
  'Karachi Kings': 'KK', 'KK': 'KK',
  'Islamabad United': 'IU', 'IU': 'IU',
  'Peshawar Zalmi': 'PZ', 'PZ': 'PZ',
  'Quetta Gladiators': 'QG', 'QG': 'QG',
  'Multan Sultans': 'MS', 'MS': 'MS',
  'Hyderabad Kingsmen': 'HK', 'HK': 'HK',
  'Rawalpindi Pindiz': 'RP', 'RP': 'RP',
};

const TEAM_COLORS: Record<string, string> = {
  'LQ': 'from-red-600 to-red-800', 'Lahore Qalandars': 'from-red-600 to-red-800',
  'KK': 'from-blue-600 to-blue-800', 'Karachi Kings': 'from-blue-600 to-blue-800',
  'IU': 'from-red-700 to-orange-600', 'Islamabad United': 'from-red-700 to-orange-600',
  'PZ': 'from-yellow-400 to-yellow-600', 'Peshawar Zalmi': 'from-yellow-400 to-yellow-600',
  'QG': 'from-purple-600 to-purple-800', 'Quetta Gladiators': 'from-purple-600 to-purple-800',
  'MS': 'from-cyan-500 to-cyan-700', 'Multan Sultans': 'from-cyan-500 to-cyan-700',
  'HK': 'from-orange-500 to-amber-700', 'Hyderabad Kingsmen': 'from-orange-500 to-amber-700',
  'RP': 'from-emerald-500 to-emerald-700', 'Rawalpindi Pindiz': 'from-emerald-500 to-emerald-700',
};

const TEAM_LOGOS: Record<string, string> = {
  'LQ': lqLogo, 'Lahore Qalandars': lqLogo,
  'KK': kkLogo, 'Karachi Kings': kkLogo,
  'IU': iuLogo, 'Islamabad United': iuLogo,
  'PZ': pzLogo, 'Peshawar Zalmi': pzLogo,
  'QG': qgLogo, 'Quetta Gladiators': qgLogo,
  'MS': msLogo, 'Multan Sultans': msLogo,
  'HK': hkLogo, 'Hyderabad Kingsmen': hkLogo,
  'RP': rpLogo, 'Rawalpindi Pindiz': rpLogo,
};

const TEAM_FULL_NAMES: Record<string, string> = {
  'LQ': 'Lahore Qalandars', 'KK': 'Karachi Kings',
  'IU': 'Islamabad United', 'PZ': 'Peshawar Zalmi',
  'QG': 'Quetta Gladiators', 'MS': 'Multan Sultans',
  'HK': 'Hyderabad Kingsmen', 'RP': 'Rawalpindi Pindiz',
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

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${team} logo`}
        className={cn(sizeMap[size], 'object-contain', className)}
        loading="lazy"
      />
    );
  }

  const abbr = TEAM_ABBR[team] || team.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const gradient = TEAM_COLORS[team] || 'from-gray-500 to-gray-700';

  return (
    <div className={cn(
      sizeMap[size],
      'rounded-full flex items-center justify-center text-white font-display font-bold bg-gradient-to-br shadow-md text-xs',
      gradient,
      className
    )}>
      {abbr}
    </div>
  );
};

export const getTeamFullName = (teamKey: string): string => {
  return TEAM_FULL_NAMES[teamKey] || teamKey;
};

export { TEAM_ABBR, TEAM_COLORS, TEAM_FULL_NAMES };
