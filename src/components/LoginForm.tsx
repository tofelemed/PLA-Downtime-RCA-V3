
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusIcon } from '@/lib/icons';
import { LOGIN_COPY } from '@/features/login/login-copy';
import { LoginHeroPanel } from '@/features/login/login-hero-panel';
import { useLoginDocumentTitle } from '@/features/login/use-login-document-title';
import { useSignInBranding } from '@/features/login/use-sign-in-branding';

const FIELD_LABEL = 'text-xs font-semibold tracking-[0.15em] text-foreground';

export const LoginForm: React.FC = () => {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const branding = useSignInBranding();
  const appName = branding?.appName ?? 'Traverse Forge';
  useLoginDocumentTitle(`Sign in · ${appName}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try { await login(email, password); }
    catch { setError('The sign-in service is temporarily unavailable. Please try again.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <LoginHeroPanel />

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 md:px-10 md:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              {branding?.logoUrl && <img src={branding.logoUrl} alt="" className="h-10 w-10 object-contain" data-testid="sign-in-logo" />}
              <div>
                <p className="text-sm font-bold tracking-[0.2em] text-foreground" data-testid="sign-in-app-name">{branding ? branding.appName.toUpperCase() : LOGIN_COPY.appName}</p>
                {(branding ? branding.appSubtitle : LOGIN_COPY.appSubtitle) && (
                  <p className="mt-1 font-mono text-xs tracking-[0.1em] text-muted-foreground lg:tracking-[0.2em]">
                    {branding ? branding.appSubtitle?.toUpperCase() : LOGIN_COPY.appSubtitle}
                  </p>
                )}
              </div>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{LOGIN_COPY.heading}</h1>
          </div>

          <div className="mb-6 rounded-md border border-border bg-muted p-3 text-xs leading-relaxed text-foreground">
            <strong className="font-semibold text-foreground">{LOGIN_COPY.noticeLead}</strong> {LOGIN_COPY.noticeBody}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={FIELD_LABEL}>{LOGIN_COPY.userIdLabel}</Label>
              <Input
                id="email"
                type="email"
                placeholder={LOGIN_COPY.userIdPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={FIELD_LABEL}>{LOGIN_COPY.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                placeholder={LOGIN_COPY.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {(error || loginError) && (
              <Alert variant="destructive">
                <AlertDescription>{error || loginError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <StatusIcon.loading className="mr-2 h-4 w-4 animate-spin" />}
              {LOGIN_COPY.submit}
            </Button>

            <p className="text-center text-xs text-muted-foreground">{LOGIN_COPY.help}</p>
          </form>
        </div>
      </main>
    </div>
  );
};
