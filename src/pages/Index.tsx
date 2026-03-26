import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { MatchCard } from '@/components/MatchCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type MatchStatus = 'upcoming' | 'live' | 'completed';

const Index = () => {
  const [activeTab, setActiveTab] = useState<MatchStatus>('upcoming');
  const queryClient = useQueryClient();
  const autoSyncTriggered = useRef(false);

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
    refetchInterval: 30000,
  });

  // Auto-sync on first load if no matches
  useEffect(() => {
    if (!isLoading && matches.length === 0 && !autoSyncTriggered.current) {
      autoSyncTriggered.current = true;
      supabase.functions.invoke('sync-matches').then(() => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        setTimeout(() => supabase.functions.invoke('sync-players'), 5000);
      });
    }
  }, [isLoading, matches.length, queryClient]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredMatches = matches.filter(m => m.status === activeTab);
  const liveCt = matches.filter(m => m.status === 'live').length;

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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatchStatus)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="upcoming" className="font-display text-xs data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="live" className="font-display text-xs data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground relative">
              Live {liveCt > 0 && <span className="ml-1 w-2 h-2 rounded-full bg-destructive inline-block animate-pulse" />}
            </TabsTrigger>
            <TabsTrigger value="completed" className="font-display text-xs data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm">Loading matches...</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No {activeTab} matches right now.
              </p>
            ) : (
              filteredMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
