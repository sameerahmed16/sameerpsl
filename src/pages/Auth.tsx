import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    if (isLogin || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      setUsernameAvailable(!data);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isLogin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('Password reset link sent! Check your email. 📧');
        setMode('login');
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back! 🏏');
      } else {
        if (usernameAvailable === false) {
          toast.error('Username is already taken. Please choose another.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success('Account created! You are now signed in. 🏏');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result?.error) toast.error(String(result.error));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display font-black text-3xl">
            <span className="text-gradient-primary">Fantasy</span>
            <span className="text-gradient-gold ml-1">PSL</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isForgot ? 'Reset your password' : isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="CricketKing99"
                  className="pl-10 pr-10 bg-card border-border text-foreground"
                  required
                  minLength={3}
                />
                {username.length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    ) : usernameAvailable === true ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : usernameAvailable === false ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {usernameAvailable === false && (
                <p className="text-xs text-red-500">Username is already taken</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10 bg-card border-border text-foreground"
                required
              />
            </div>
          </div>

          {!isForgot && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-card border-border text-foreground"
                  minLength={6}
                  required
                />
              </div>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-primary hover:underline font-display"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (mode === 'signup' && usernameAvailable === false)}
            className="w-full gradient-primary text-primary-foreground font-display font-bold py-5"
          >
            {loading ? 'Loading...' : isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        {!isForgot && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              className="w-full border-border text-foreground font-display"
            >
              Continue with Google
            </Button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isForgot ? (
            <button onClick={() => setMode('login')} className="text-primary hover:underline font-display font-semibold">
              Back to sign in
            </button>
          ) : isLogin ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')} className="text-primary hover:underline font-display font-semibold">Sign up</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-primary hover:underline font-display font-semibold">Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
