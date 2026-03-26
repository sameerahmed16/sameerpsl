import { Layout } from '@/components/Layout';
import { LEAGUES } from '@/data/mockData';
import { Users, Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Leagues = () => {
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
          <Button size="sm" className="gradient-primary text-primary-foreground font-display font-semibold">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>

        <div className="space-y-3">
          {LEAGUES.map(league => (
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
                <span className="text-xs font-display font-semibold text-secondary">{league.prize}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Leagues;
