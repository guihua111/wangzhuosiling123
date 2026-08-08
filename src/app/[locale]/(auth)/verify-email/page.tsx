import { redirect } from '@/core/i18n/navigation';

export default async function VerifyEmailRoute({
  searchParams,
  params,
}: {
  searchParams: Promise<{
    email?: string;
    callbackUrl?: string;
  }>;
  params: Promise<{ locale: string }>;
}) {
  const { email, callbackUrl } = await searchParams;
  const { locale } = await params;
  const query = new URLSearchParams({ callbackUrl: callbackUrl || '/' });
  if (email) query.set('email', email);

  // Email verification is no longer part of the FinReach sign-up flow. Keep
  // old bookmarks and already-open tabs useful by sending them to password
  // sign-in instead of rendering the retired verification screen.
  redirect({ href: `/sign-in?${query}`, locale });
}
