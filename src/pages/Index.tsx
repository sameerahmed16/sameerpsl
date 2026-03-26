import { Layout } from '@/components/Layout';
import { MatchCard } from '@/components/MatchCard';
import { Flame, Calendar, CheckCircle, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useEffect } from 'react';

const Index = () => {
  const queryClient = useQueryClient();

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
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Realtime subscription for live match updates
  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['matches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-matches');
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Sync failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.matches_synced} matches from CricAPI! 🏏`);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (error: any) => toast.error(`Sync failed: ${error.message}`),
  });

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <Layout>
      <div className="space-y-6 pt-4">
        <div className="gradient-hero rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-black text-2xl text-foreground mb-1">
                PSL <span className="text-gradient-gold">2026</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Build your fantasy team & compete with friends
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="border-border text-foreground hover:bg-muted"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground text-sm py-8">Loading matches...</p>
        ) : matches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-4">No matches found. Sync data from CricAPI to get started.</p>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gradient-primary text-primary-foreground font-display"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync PSL Matches
            </Button>
          </div>
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
