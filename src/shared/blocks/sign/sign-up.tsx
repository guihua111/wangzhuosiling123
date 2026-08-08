'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signUp } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { SocialProviders } from './social-providers';

export function SignUp({
  configs,
  callbackUrl = '/',
}: {
  configs: Record<string, string>;
  callbackUrl: string;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth
  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const reportAffiliate = ({
    userEmail,
    stripeCustomerId,
  }: {
    userEmail: string;
    stripeCustomerId?: string;
  }) => {
    if (typeof window === 'undefined' || !configs) {
      return;
    }

    const windowObject = window as any;

    if (configs.affonso_enabled === 'true' && windowObject.Affonso) {
      windowObject.Affonso.signup(userEmail);
    }

    if (configs.promotekit_enabled === 'true' && windowObject.promotekit) {
      windowObject.promotekit.refer(userEmail, stripeCustomerId);
    }
  };

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    if (!email || !password || !name) {
      toast.error('email, password and name are required');
      return;
    }

    // Set loading immediately to avoid duplicate submits before request hooks fire.
    setLoading(true);

    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onRequest: (ctx) => {
            // loading is already set above; keep as no-op for safety
          },
          onResponse: (ctx) => {
            // Do NOT reset loading here; navigation may not have completed yet.
          },
          onSuccess: (ctx) => {
            // report affiliate
            reportAffiliate({ userEmail: email });

            // Registration creates a session immediately. Reload through the
            // destination so every server/client component sees the new cookie.
            window.location.assign(callbackUrl || '/');
          },
          onError: (e: any) => {
            toast.error(e?.error?.message || 'sign up failed');
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e?.message || 'sign up failed');
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('sign_up_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('sign_up_description')}</h2>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {isEmailAuthEnabled && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSignUp();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="name">{t('name_title')}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t('name_placeholder')}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  value={name}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">{t('email_title')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email_placeholder')}
                  required
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  value={email}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">{t('password_title')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('password_placeholder')}
                  autoComplete="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <p>{t('sign_up_title')}</p>
                )}
              </Button>
            </form>
          )}

          <SocialProviders
            configs={configs}
            callbackUrl={callbackUrl || '/'}
            loading={loading}
            setLoading={setLoading}
          />
        </div>
      </CardContent>
      {isEmailAuthEnabled && (
        <CardFooter>
          <div className="flex w-full justify-center border-t py-4">
            <p className="text-center text-xs text-neutral-500">
              {t('already_have_account')}
              <Link href="/sign-in" className="underline">
                <span className="cursor-pointer dark:text-white/70">
                  {t('sign_in_title')}
                </span>
              </Link>
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
