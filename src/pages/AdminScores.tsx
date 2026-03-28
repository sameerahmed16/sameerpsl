import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Save, RefreshCw } from 'lucide-react';

const ADMIN_EMAILS = ['admin@psl.com', 'sameer@psl.com'];

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  status: string;
  team_a_score: string | null;
  team_b_score: string | null;
  cricbuzz_match_id: string | null;
  espn_match_id: string | null;
}

interface PlayerPointRow {
  player_id: string;
  player_name: string;
  points: number;
}

export default function AdminScores() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');
  const [matchStatus, setMatchStatus] = useState('live');
  const [cricbuzzId, setCricbuzzId] = useState('');
  const [espnId, setEspnId] = useState('');
  const [playerPoints, setPlayerPoints] = useState<PlayerPointRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch) loadMatchDetails();
  }, [selectedMatch]);

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select('id, team_a, team_b, status, team_a_score, team_b_score, cricbuzz_match_id, espn_match_id')
      .order('match_date', { ascending: false });
    if (data) setMatches(data as MatchRow[]);
  }

  async function loadMatchDetails() {
    const match = matches.find(m => m.id === selectedMatch);
    if (!match) return;
    setTeamAScore(match.team_a_score || '');
    setTeamBScore(match.team_b_score || '');
    setMatchStatus(match.status);
    setCricbuzzId(match.cricbuzz_match_id || '');
    setEspnId(match.espn_match_id || '');

    const { data: matchPlayers } = await supabase
      .from('match_players')
      .select('player_id, players(id, name)')
      .eq('match_id', selectedMatch);

    if (matchPlayers) {
      const { data: existingPoints } = await supabase
        .from('match_player_points')
        .select('player_id, points')
        .eq('match_id', selectedMatch);

      const pointsMap = new Map((existingPoints || []).map(p => [p.player_id, p.points]));

      setPlayerPoints(
        matchPlayers.map((mp: any) => ({
          player_id: mp.players?.id || mp.player_id,
          player_name: mp.players?.name || 'Unknown',
          points: pointsMap.get(mp.player_id) || 0,
        }))
      );
    }
  }

  async function saveMatchScores() {
    if (!selectedMatch) return;
    setSaving(true);

    try {
      // Call edge function with service role (server-side) instead of direct DB update
      const { data, error } = await supabase.functions.invoke('admin-update-scores', {
        body: {
          match_id: selectedMatch,
          team_a_score: teamAScore || null,
          team_b_score: teamBScore || null,
          status: matchStatus,
          cricbuzz_match_id: cricbuzzId || null,
          espn_match_id: espnId || null,
          player_points: playerPoints.map(pp => ({
            player_id: pp.player_id,
            points: pp.points,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Scores saved and points recalculated!');
      loadMatches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save scores');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function updatePlayerPoints(playerId: string, points: number) {
    setPlayerPoints(prev =>
      prev.map(p => (p.player_id === playerId ? { ...p, points } : p))
    );
  }

  async function retrySyncLiveScores() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-live-scores');
      if (error) throw error;
      toast.success(`Sync complete: ${JSON.stringify(data)}`);
      loadMatches();
      if (selectedMatch) loadMatchDetails();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="p-8 text-center bg-card border-border">
            <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You don't have admin access to this page.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  const selectedMatchData = matches.find(m => m.id === selectedMatch);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Admin: Manual Score Entry</h1>
        </div>

        <Card className="p-4 bg-card border-border space-y-4">
          <Label className="text-foreground">Select Match</Label>
          <Select value={selectedMatch} onValueChange={setSelectedMatch}>
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue placeholder="Choose a match..." />
            </SelectTrigger>
            <SelectContent>
              {matches.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.team_a} vs {m.team_b}
                  <Badge variant="outline" className="ml-2 text-xs">{m.status}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {selectedMatch && selectedMatchData && (
          <>
            <Card className="p-4 bg-card border-border space-y-4">
              <h2 className="font-display font-semibold text-foreground">External Match IDs</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cricbuzz Match ID</Label>
                  <Input value={cricbuzzId} onChange={e => setCricbuzzId(e.target.value)} placeholder="e.g. 91715" className="bg-muted border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-muted-foreground">ESPN Match ID</Label>
                  <Input value={espnId} onChange={e => setEspnId(e.target.value)} placeholder="e.g. 1384420" className="bg-muted border-border text-foreground" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-card border-border space-y-4">
              <h2 className="font-display font-semibold text-foreground">Match Scores</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">{selectedMatchData.team_a} Score</Label>
                  <Input value={teamAScore} onChange={e => setTeamAScore(e.target.value)} placeholder="185/4 (20.0)" className="bg-muted border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-muted-foreground">{selectedMatchData.team_b} Score</Label>
                  <Input value={teamBScore} onChange={e => setTeamBScore(e.target.value)} placeholder="170/8 (20.0)" className="bg-muted border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select value={matchStatus} onValueChange={setMatchStatus}>
                    <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {playerPoints.length > 0 && (
              <Card className="p-4 bg-card border-border space-y-4">
                <h2 className="font-display font-semibold text-foreground">Player Fantasy Points</h2>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Player</TableHead>
                      <TableHead className="text-muted-foreground text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerPoints.map(pp => (
                      <TableRow key={pp.player_id} className="border-border">
                        <TableCell className="text-foreground font-medium">{pp.player_name}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={pp.points}
                            onChange={e => updatePlayerPoints(pp.player_id, parseInt(e.target.value) || 0)}
                            className="w-24 ml-auto bg-muted border-border text-foreground text-right"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={saveMatchScores} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? 'Saving...' : 'Save & Recalculate Points'}
              </Button>
              <Button variant="outline" onClick={retrySyncLiveScores} disabled={syncing}>
                {syncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {syncing ? 'Syncing...' : 'Retry Live Sync'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
