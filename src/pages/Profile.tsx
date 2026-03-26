import { Layout } from '@/components/Layout';
import { User, Trophy, Target, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Profile = () => {
  return (
    <Layout>
      <div className="space-y-6 pt-4">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display font-black text-xl text-foreground">Guest User</h1>
          <p className="text-sm text-muted-foreground">Sign in to save your progress</p>
          <Button className="mt-3 gradient-gold text-secondary-foreground font-display font-semibold">
            Sign In
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Trophy, label: 'Points', value: '0' },
            { icon: Target, label: 'Matches', value: '0' },
            { icon: Calendar, label: 'Leagues', value: '0' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="gradient-card rounded-lg border border-border p-3 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="font-display font-black text-lg text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Scoring guide */}
        <div className="gradient-card rounded-lg border border-border p-4">
          <h2 className="font-display font-bold text-foreground mb-3">Scoring Guide</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Run scored', '+1'],
              ['Boundary', '+1'],
              ['Six', '+2'],
              ['Wicket', '+25'],
              ['Catch', '+8'],
              ['Run out', '+12'],
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
      </div>
    </Layout>
  );
};

export default Profile;
