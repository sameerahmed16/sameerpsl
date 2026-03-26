import { Layout } from '@/components/Layout';
import { MatchCard } from '@/components/MatchCard';
import { MATCHES } from '@/data/mockData';
import { Flame, Calendar, CheckCircle } from 'lucide-react';

const Index = () => {
  const liveMatches = MATCHES.filter(m => m.status === 'live');
  const upcomingMatches = MATCHES.filter(m => m.status === 'upcoming');
  const completedMatches = MATCHES.filter(m => m.status === 'completed');

  return (
    <Layout>
      <div className="space-y-6 pt-4">
        {/* Hero */}
        <div className="gradient-hero rounded-xl p-6 border border-border">
          <h1 className="font-display font-black text-2xl text-foreground mb-1">
            PSL <span className="text-gradient-gold">2026</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Build your fantasy team & compete with friends
          </p>
        </div>

        {/* Live */}
        {liveMatches.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-destructive" /> Live
            </h2>
            <div className="space-y-3">
              {liveMatches.map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcomingMatches.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-secondary" /> Upcoming
            </h2>
            <div className="space-y-3">
              {upcomingMatches.map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}

        {/* Completed */}
        {completedMatches.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-muted-foreground" /> Completed
            </h2>
            <div className="space-y-3">
              {completedMatches.map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default Index;
