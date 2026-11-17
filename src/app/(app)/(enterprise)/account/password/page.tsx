import { getTranslations } from 'next-intl/server';
import { ChangePasswordForm } from '@/core/auth/ui/change-password-form';
import { PageHeader } from '@/core/ui/page-header';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('passwordTitle') };
}

export default async function ChangePasswordPage() {
  const t = await getTranslations('account');
  return (
    <>
      <PageHeader title={t('passwordTitle')} description={t('passwordDescription')} />
      <ChangePasswordForm />
    </>
  );
}
