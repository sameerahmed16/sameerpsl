import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const Leagues = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prize, setPrize] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*, league_members(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(l => ({
        ...l,
        members: (l.league_members as any)?.[0]?.count || 0,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase
        .from('leagues')
        .insert({ name, code, created_by: user.id, prize: prize || null })
        .select()
        .single();
      if (error) throw error;
      // Auto-join
      await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id });
      return data;
    },
    onSuccess: () => {
      toast.success('League created!');
      setName('');
      setPrize('');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data: league, error: findError } = await supabase
        .from('leagues')
        .select('id')
        .eq('code', joinCode.toUpperCase())
        .single();
      if (findError) throw new Error('League not found');
      const { error } = await supabase
        .from('league_members')
        .insert({ league_id: league.id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Joined league!');
      setJoinCode('');
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('League code copied!');
  };

  return (
    <Layout>
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-black text-2xl text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Leagues
          </h1>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary text-primary-foreground font-display font-semibold">
                <Plus className="w-4 h-4 mr-1" /> Create
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display text-foreground">Create League</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="League name" value={name} onChange={e => setName(e.target.value)} className="bg-muted border-border text-foreground" />
                <Input placeholder="Prize (optional)" value={prize} onChange={e => setPrize(e.target.value)} className="bg-muted border-border text-foreground" />
                <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full gradient-primary text-primary-foreground font-display font-semibold">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Join league */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter league code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            className="bg-card border-border text-foreground"
          />
          <Button onClick={() => joinMutation.mutate()} disabled={!joinCode || joinMutation.isPending} className="gradient-gold text-secondary-foreground font-display font-semibold shrink-0">
            Join
          </Button>
        </div>

        <div className="space-y-3">
          {leagues.map(league => (
            <div key={league.id} className="gradient-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-bold text-foreground">{league.name}</h3>
                <span className="text-xs text-muted-foreground">{league.members} members</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Code:</span>
                  <code className="text-xs bg-muted text-foreground px-2 py-0.5 rounded font-body">{league.code}</code>
                  <button onClick={() => copyCode(league.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {league.prize && <span className="text-xs font-display font-semibold text-secondary">{league.prize}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Leagues;
