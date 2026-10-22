export type StartupFailure = 'config' | 'network' | 'auth' | 'unknown';

export function startupCause(caught: unknown): string {
  const code =
    caught && typeof caught === 'object' && 'code' in caught
      ? String((caught as { code?: unknown }).code ?? '')
      : '';
  const message = caught instanceof Error ? caught.message : typeof caught === 'string' ? caught : '';
  const detail = [code, message].map(part => part.trim()).filter(Boolean).join(': ');
  return detail || 'Unknown error';
}

export function classifyStartupError(caught: unknown): StartupFailure {
  const haystack = startupCause(caught).toLowerCase();
  if (
    haystack.includes('no-app') ||
    haystack.includes('no firebase app') ||
    haystack.includes('googleservice') ||
    haystack.includes('google-services') ||
    haystack.includes('has not been configured') ||
    haystack.includes('firebase app')
  ) {
    return 'config';
  }
  if (
    haystack.includes('operation-not-allowed') ||
    haystack.includes('admin-restricted') ||
    haystack.includes('enable this service')
  ) {
    return 'auth';
  }
  if (
    haystack.includes('network-request-failed') ||
    haystack.includes('network request failed') ||
    haystack.includes('unavailable') ||
    haystack.includes('deadline-exceeded') ||
    haystack.includes('offline') ||
    haystack.includes('failed to fetch') ||
    haystack.includes('timeout')
  ) {
    return 'network';
  }
  return 'unknown';
}
