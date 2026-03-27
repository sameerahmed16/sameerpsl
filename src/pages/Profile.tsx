import { Layout } from '@/components/Layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Trophy, Target, Calendar, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: teamCount = 0 } = useQuery({
    queryKey: ['team-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_teams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: leagueCount = 0 } = useQuery({
    queryKey: ['league-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Layout>
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display font-black text-xl text-foreground">{profile?.username || 'Loading...'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Trophy, label: 'Points', value: profile?.total_points || 0 },
            { icon: Target, label: 'Matches', value: teamCount },
            { icon: Calendar, label: 'Leagues', value: leagueCount },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="gradient-card rounded-lg border border-border p-3 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-display font-black text-lg text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="gradient-card rounded-lg border border-border p-4">
          <h2 className="font-display font-bold text-foreground mb-3">Scoring Guide</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Starting XI', '+4'],
              ['Run scored', '+1'],
              ['Boundary (4)', '+4'],
              ['Six', '+6'],
              ['25 runs', '+8'],
              ['Half century', '+8'],
              ['Century', '+16'],
              ['Duck', '-2'],
              ['Wicket', '+30'],
              ['3-wicket haul', '+4'],
              ['4-wicket haul', '+8'],
              ['5-wicket haul', '+16'],
              ['Maiden over', '+12'],
              ['Catch', '+8'],
              ['Stumping', '+12'],
              ['Run out', '+12'],
              ['MOTM', '+30'],
              ['Captain bonus', '2x'],
              ['Vice-Captain bonus', '1.5x'],
            ].map(([action, pts]) => (
              <div key={action} className="flex justify-between">
                <span className="text-muted-foreground">{action}</span>
                <span className="font-display font-bold text-secondary">{pts}</span>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full border-border text-destructive font-display"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </Layout>
  );
};

export default Profile;
