import { cn } from '@/lib/utils';
import { useState } from 'react';

const TEAM_LOGOS: Record<string, string> = {
  'Lahore Qalandars': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340089.png',
  'LQ': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340089.png',
  'Karachi Kings': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340091.png',
  'KK': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340091.png',
  'Islamabad United': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340087.png',
  'IU': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340087.png',
  'Peshawar Zalmi': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340093.png',
  'PZ': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340093.png',
  'Quetta Gladiators': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340095.png',
  'QG': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340095.png',
  'Multan Sultans': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340097.png',
  'MS': 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160/lsci/db/PICTURES/CMS/340000/340097.png',
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
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = TEAM_LOGOS[team];
  const abbr = team.length <= 3 ? team : team.split(' ').map(w => w[0]).join('').slice(0, 2);
  const colorClass = TEAM_COLORS[team] || 'bg-muted';

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={team}
        className={cn(sizeMap[size], 'object-contain rounded-full', className)}
        onError={() => setImgFailed(true)}
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
