import { useState } from 'react';
import { cn } from '@/lib/utils';

const TEAM_ABBR: Record<string, string> = {
  'Lahore Qalandars': 'LQ',
  'LQ': 'LQ',
  'Karachi Kings': 'KK',
  'KK': 'KK',
  'Islamabad United': 'IU',
  'IU': 'IU',
  'Peshawar Zalmi': 'PZ',
  'PZ': 'PZ',
  'Quetta Gladiators': 'QG',
  'QG': 'QG',
  'Multan Sultans': 'MS',
  'MS': 'MS',
  'Hyderabad Kingsmen': 'HK',
  'HK': 'HK',
  'Rawalpindi Pindiz': 'RP',
  'RP': 'RP',
};

const TEAM_COLORS: Record<string, string> = {
  'LQ': 'from-red-600 to-red-800',
  'Lahore Qalandars': 'from-red-600 to-red-800',
  'KK': 'from-blue-600 to-blue-800',
  'Karachi Kings': 'from-blue-600 to-blue-800',
  'IU': 'from-red-700 to-orange-600',
  'Islamabad United': 'from-red-700 to-orange-600',
  'PZ': 'from-yellow-400 to-yellow-600',
  'Peshawar Zalmi': 'from-yellow-400 to-yellow-600',
  'QG': 'from-purple-600 to-purple-800',
  'Quetta Gladiators': 'from-purple-600 to-purple-800',
  'MS': 'from-cyan-500 to-cyan-700',
  'Multan Sultans': 'from-cyan-500 to-cyan-700',
  'HK': 'from-orange-500 to-amber-700',
  'Hyderabad Kingsmen': 'from-orange-500 to-amber-700',
  'RP': 'from-emerald-500 to-emerald-700',
  'Rawalpindi Pindiz': 'from-emerald-500 to-emerald-700',
};

// Team logo URLs from Cricbuzz/i.cricketcb.com CDN
const TEAM_LOGOS: Record<string, string> = {
  'LQ': 'https://i.cricketcb.com/stats/img/faceImages/ipl/LQ.jpg',
  'Lahore Qalandars': 'https://i.cricketcb.com/stats/img/faceImages/ipl/LQ.jpg',
  'KK': 'https://i.cricketcb.com/stats/img/faceImages/ipl/KK.jpg',
  'Karachi Kings': 'https://i.cricketcb.com/stats/img/faceImages/ipl/KK.jpg',
  'IU': 'https://i.cricketcb.com/stats/img/faceImages/ipl/IU.jpg',
  'Islamabad United': 'https://i.cricketcb.com/stats/img/faceImages/ipl/IU.jpg',
  'PZ': 'https://i.cricketcb.com/stats/img/faceImages/ipl/PZ.jpg',
  'Peshawar Zalmi': 'https://i.cricketcb.com/stats/img/faceImages/ipl/PZ.jpg',
  'QG': 'https://i.cricketcb.com/stats/img/faceImages/ipl/QG.jpg',
  'Quetta Gladiators': 'https://i.cricketcb.com/stats/img/faceImages/ipl/QG.jpg',
  'MS': 'https://i.cricketcb.com/stats/img/faceImages/ipl/MS.jpg',
  'Multan Sultans': 'https://i.cricketcb.com/stats/img/faceImages/ipl/MS.jpg',
  'HK': 'https://i.cricketcb.com/stats/img/faceImages/ipl/HK.jpg',
  'Hyderabad Kingsmen': 'https://i.cricketcb.com/stats/img/faceImages/ipl/HK.jpg',
  'RP': 'https://i.cricketcb.com/stats/img/faceImages/ipl/RP.jpg',
  'Rawalpindi Pindiz': 'https://i.cricketcb.com/stats/img/faceImages/ipl/RP.jpg',
};

// Canonical full names for display
const TEAM_FULL_NAMES: Record<string, string> = {
  'LQ': 'Lahore Qalandars',
  'KK': 'Karachi Kings',
  'IU': 'Islamabad United',
  'PZ': 'Peshawar Zalmi',
  'QG': 'Quetta Gladiators',
  'MS': 'Multan Sultans',
  'HK': 'Hyderabad Kingsmen',
  'RP': 'Rawalpindi Pindiz',
};

interface TeamLogoProps {
  team: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-12 h-12 text-xs',
  lg: 'w-16 h-16 text-sm',
};

const imgSizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
};

export const TeamLogo = ({ team, size = 'md', className }: TeamLogoProps) => {
  const [imgError, setImgError] = useState(false);
  const abbr = TEAM_ABBR[team] || team.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const gradient = TEAM_COLORS[team] || 'from-gray-500 to-gray-700';
  const logoUrl = TEAM_LOGOS[team];

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={`${team} logo`}
        width={imgSizeMap[size]}
        height={imgSizeMap[size]}
        className={cn(sizeMap[size], 'rounded-full object-cover shadow-md', className)}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  return (
    <div className={cn(
      sizeMap[size],
      'rounded-full flex items-center justify-center text-white font-display font-bold bg-gradient-to-br shadow-md',
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
