import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { MatchCard } from '@/components/MatchCard';
import { MatchCardCompact } from '@/components/MatchCardCompact';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, isBefore } from 'date-fns';

type MatchStatus = 'upcoming' | 'live' | 'completed';

const Index = () => {
  const [activeTab, setActiveTab] = useState<MatchStatus>('upcoming');
  const queryClient = useQueryClient();
  const autoSyncTriggered = useRef(false);
  const { user } = useAuth();

  const { data: matches = [], isLoading, isError, refetch } = useQuery({
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
    retry: 3,
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

  // Fetch user's teams to show badges
  const { data: userTeamMatchIds = [] } = useQuery({
    queryKey: ['user-team-match-ids', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_teams')
        .select('match_id')
        .eq('user_id', user!.id);
      return (data || []).map(t => t.match_id);
    },
  });

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

  // Split upcoming into "next 48h" and "later"
  const now = new Date();
  const cutoff = addDays(now, 2);
  const next48h = filteredMatches.filter(m =>
    activeTab === 'upcoming' && isBefore(new Date(m.match_date), cutoff)
  );
  const later = filteredMatches.filter(m =>
    activeTab === 'upcoming' && !isBefore(new Date(m.match_date), cutoff)
  );

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

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm">Loading matches...</p>
              </div>
            ) : activeTab === 'upcoming' ? (
              <>
                {next48h.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                      🔥 Next 48 Hours
                    </h2>
                    {next48h.map(match => (
                      <MatchCard key={match.id} match={match} hasTeam={userTeamMatchIds.includes(match.id)} />
                    ))}
                  </div>
                )}
                {later.length > 0 && (
                  <div className="space-y-1.5">
                    <h2 className="font-display font-bold text-sm text-muted-foreground">Coming Up Later</h2>
                    {later.map(match => (
                      <MatchCardCompact key={match.id} match={match} hasTeam={userTeamMatchIds.includes(match.id)} />
                    ))}
                  </div>
                )}
                {next48h.length === 0 && later.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No upcoming matches right now.
                  </p>
                )}
              </>
            ) : filteredMatches.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No {activeTab} matches right now.
              </p>
            ) : (
              filteredMatches.map(match => (
                <MatchCard key={match.id} match={match} hasTeam={userTeamMatchIds.includes(match.id)} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
