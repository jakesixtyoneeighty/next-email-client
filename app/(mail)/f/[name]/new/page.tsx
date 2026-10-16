import { Suspense } from 'react';
import ComposeForm from './form';

export const instant = false;
export default function ComposePage() {
  return (
    <Suspense fallback={<div className="loading-state">Opening compose…</div>}>
      <ComposeForm />
    </Suspense>
  );
}
