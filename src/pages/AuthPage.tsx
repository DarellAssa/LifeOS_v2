import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as Mode) || 'sign-in';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const isValid = mode === 'forgot'
    ? email.includes('@')
    : email.includes('@') && password.length >= 6 && (mode === 'sign-in' || password === confirmPassword);

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];
  const strengthColors = ['', 'bg-destructive', 'bg-warning', 'bg-green-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'sign-in') {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err); setLoading(false); return; }
      navigate('/');
    } else if (mode === 'sign-up') {
      const { error: err } = await signUp(email, password);
      if (err) { setError(err); setLoading(false); return; }
      toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
      setMode('sign-in');
    } else {
      const { error: err } = await resetPassword(email);
      if (err) { setError(err); setLoading(false); return; }
      toast({ title: 'Reset email sent', description: 'Check your inbox for password reset instructions.' });
      setMode('sign-in');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Life<span className="text-primary">OS</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'sign-in' ? 'Welcome back' : mode === 'sign-up' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === 'sign-up' && password.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-muted'}`} />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{strengthLabels[passwordStrength]}</span>
                    </div>
                  )}
                </div>
              )}

              {mode === 'sign-up' && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-destructive">Passwords don't match</p>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!isValid || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link'}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              {mode === 'sign-in' && (
                <>
                  <button onClick={() => setMode('forgot')} className="text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </button>
                  <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <button onClick={() => setMode('sign-up')} className="text-primary hover:underline font-medium">Sign up</button>
                  </p>
                </>
              )}
              {mode === 'sign-up' && (
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <button onClick={() => setMode('sign-in')} className="text-primary hover:underline font-medium">Sign in</button>
                </p>
              )}
              {mode === 'forgot' && (
                <button onClick={() => setMode('sign-in')} className="text-primary hover:underline font-medium">
                  Back to sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
