import { Suspense } from 'react';
import { ResetForm } from './form';
export const metadata = { title: 'Set your password', referrer: 'no-referrer' };
export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
