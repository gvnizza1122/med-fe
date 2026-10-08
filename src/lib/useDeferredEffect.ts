'use client';
import { useEffect, type DependencyList, type EffectCallback } from 'react';

// Schedule initialization after commit. Cancelling before the task starts also
// prevents duplicate initialization during StrictMode's setup/cleanup check.
export function scheduleEffect(effect: EffectCallback): () => void {
  let cleanup: ReturnType<EffectCallback>;
  const timer = setTimeout(() => { cleanup = effect(); }, 0);
  return () => { clearTimeout(timer); if (typeof cleanup === 'function') cleanup(); };
}

export function useDeferredEffect(effect: EffectCallback, dependencies: DependencyList) {
  // The caller's dependencies are checked by additionalEffectHooks in ESLint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => scheduleEffect(effect), dependencies);
}
