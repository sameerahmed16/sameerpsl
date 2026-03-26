import { Link, useLocation } from 'react-router-dom';
import { Home, Trophy, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { path: '/', label: 'Matches', icon: Home },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/leagues', label: 'Leagues', icon: Users },
  { path: '/profile', label: 'Profile', icon: User },
];

export const Navbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const initial = user?.email?.[0]?.toUpperCase() || 'U';
  
  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="font-display font-black text-xl">
            <span className="text-gradient-primary">Fantasy</span>
            <span className="text-gradient-gold ml-1">PSL</span>
          </Link>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-display font-bold text-foreground">
            {initial}
          </div>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="container max-w-lg mx-auto flex items-center justify-around h-16 px-4">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center gap-1 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-display font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
