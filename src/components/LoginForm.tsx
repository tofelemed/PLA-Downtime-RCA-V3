
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { LOGIN_COPY } from '@/features/login/login-copy';
import { LoginHeroPanel } from '@/features/login/login-hero-panel';
import { DemoAccountsHint } from '@/features/login/demo-accounts-hint';
import { useLoginDocumentTitle } from '@/features/login/use-login-document-title';

const FIELD_LABEL = 'text-xs font-semibold tracking-[0.15em] text-slate-700';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  useLoginDocumentTitle(LOGIN_COPY.documentTitle);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await login(email, password);

    if (!success) {
      setError(LOGIN_COPY.invalidCredentials);
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <LoginHeroPanel />

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 md:px-10 md:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-[0.2em] text-slate-900">{LOGIN_COPY.appName}</h1>
            <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-slate-600 lg:text-xs lg:tracking-[0.2em]">
              {LOGIN_COPY.appSubtitle}
            </p>
          </div>

          <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <strong className="font-semibold text-slate-900">{LOGIN_COPY.noticeLead}</strong> {LOGIN_COPY.noticeBody}
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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {LOGIN_COPY.submit}
            </Button>

            <p className="text-center text-xs text-slate-600">{LOGIN_COPY.help}</p>
          </form>

          <DemoAccountsHint />
        </div>
      </main>
    </div>
  );
};
