import { useState, useEffect } from 'react';
import { Clock, Lock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string;
  isLocked: boolean;
}

export const CountdownTimer = ({ targetDate, isLocked }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Match Started');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (isLocked || isExpired) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm font-display font-semibold">
        <Lock className="w-4 h-4" />
        <span>Team Locked</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-secondary text-sm font-display font-semibold">
      <Clock className="w-4 h-4" />
      <span>Locks in: {timeLeft}</span>
    </div>
  );
};
