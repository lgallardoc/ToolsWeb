/**
 * Privacy helpers — keep OAuth / identity-provider noise out of tutorials.
 * (Google sign-in URLs, client_id, tokens, consent params, etc.)
 */

const SENSITIVE_HOST_SUFFIXES = [
  'accounts.google.com',
  'accounts.youtube.com',
  'myaccount.google.com',
  'oauth2.googleapis.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'github.com',
  'gitlab.com',
  'auth0.com',
  'okta.com',
] as const;

const SENSITIVE_PATH_MARKERS = [
  '/o/oauth2',
  '/signin/oauth',
  '/signin/identifier',
  '/signin/challenge',
  '/signin/accountchooser',
  '/InteractiveLogin',
  '/oauth2/v2/auth',
  '/login/oauth',
  '/authorize',
] as const;

/** True when the URL should never appear in capture UI or exports. */
export function isSensitiveAuthUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (
      SENSITIVE_HOST_SUFFIXES.some(
        (h) => host === h || host.endsWith(`.${h}`)
      )
    ) {
      // github/gitlab: only auth paths, not every page
      if (host === 'github.com' || host.endsWith('.github.com')) {
        return /\/(login|sessions|auth)\b/i.test(u.pathname) || u.pathname.includes('/login/oauth');
      }
      if (host.includes('gitlab')) {
        return /\/(users\/sign_in|oauth)\b/i.test(u.pathname);
      }
      return true;
    }
    const pathAndQuery = `${u.pathname}${u.search}`.toLowerCase();
    return SENSITIVE_PATH_MARKERS.some((m) => pathAndQuery.includes(m.toLowerCase()));
  } catch {
    return /accounts\.google\.com|client_id=|oauth|access_token|id_token/i.test(raw);
  }
}

/** Safe URL for tutorials: origin + pathname only (no query/hash secrets). */
export function sanitizeTutorialUrl(raw: string): string {
  if (isSensitiveAuthUrl(raw)) {
    try {
      const u = new URL(raw);
      return `${u.origin}${u.pathname}`;
    } catch {
      return 'https://invalid.local/auth';
    }
  }
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return 'https://invalid.local/url';
  }
}

const SECRETISH =
  /\b(client_id|client_secret|access_token|id_token|refresh_token|code|state|nonce|scope)=[^\s&]+/gi;

/** Strip OAuth-looking tokens/params from free text (descriptions). */
export function sanitizeTutorialText(raw: string): string {
  let s = raw.replace(SECRETISH, '$1=[redacted]');
  // Collapse long google account URLs pasted into descriptions
  s = s.replace(/https?:\/\/accounts\.google\.com\S+/gi, '[auth omitted]');
  s = s.replace(/https?:\/\/\S{120,}/g, (match) => {
    if (isSensitiveAuthUrl(match)) return '[auth omitted]';
    return sanitizeTutorialUrl(match);
  });
  return s;
}
