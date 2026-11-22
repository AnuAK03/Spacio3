import { useEffect, useState } from 'react';

let cachedKeyPromise: Promise<string> | null = null;
let resolvedCachedKey: string | null = null;

function readStaticViteKey(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function loadGoogleMapsApiKey(): Promise<string> {
  if (resolvedCachedKey !== null) {
    return Promise.resolve(resolvedCachedKey);
  }
  const viteKey = readStaticViteKey();
  if (viteKey) {
    resolvedCachedKey = viteKey;
    return Promise.resolve(viteKey);
  }
  if (!cachedKeyPromise) {
    cachedKeyPromise = fetch('/api/maps/config')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        const key = typeof data.apiKey === 'string' ? data.apiKey.trim() : '';
        resolvedCachedKey = key;
        return key;
      })
      .catch(() => {
        resolvedCachedKey = '';
        return '';
      });
  }
  return cachedKeyPromise;
}

export function isGoogleMapsQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === 'string'
      ? err
      : err instanceof Error
      ? err.message
      : JSON.stringify(err);
  const upper = msg.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVERQUOTAMAPERROR') ||
    upper.includes('QUOTAEXCEEDED') ||
    upper.includes('429')
  );
}

export function reportGoogleMapsQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

export function useGoogleMapsConfig(): {
  apiKey: string;
  loading: boolean;
  quotaExceeded: boolean;
} {
  const [apiKey, setApiKey] = useState<string>(resolvedCachedKey ?? readStaticViteKey());
  const [loading, setLoading] = useState<boolean>(resolvedCachedKey === null && !readStaticViteKey());
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    loadGoogleMapsApiKey().then((k) => {
      if (!active) return;
      setApiKey(k);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  return { apiKey, loading, quotaExceeded };
}
