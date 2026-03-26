import { Layout } from '@/components/Layout';
import { MatchCard } from '@/components/MatchCard';
import { Flame, Calendar, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <Layout>
      <div className="space-y-6 pt-4">
        <div className="gradient-hero rounded-xl p-6 border border-border">
          <h1 className="font-display font-black text-2xl text-foreground mb-1">
            PSL <span className="text-gradient-gold">2026</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Build your fantasy team & compete with friends
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading matches...</p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Layout>
  );
};

export default Index;
