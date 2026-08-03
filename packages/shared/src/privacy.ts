/**
 * PrivacyFilter — redact or classify sensitive values (Prompt Maestro §8 / ADR-0005).
 * Keeps OAuth URL scrubbing helpers used by the Playwright bridge.
 */

export const REDACTED = '[REDACTED]' as const;

export type PrivacyFilterConfig = {
  /** Redact email-shaped strings in free text / values. Default true. */
  redactEmail?: boolean;
  /** Redact phone-shaped strings. Default true. */
  redactPhone?: boolean;
  /** Keep masked length as `[REDACTED:n]` instead of plain token. Default false. */
  keepLength?: boolean;
  /** Extra case-insensitive substrings (labels/names/selectors) that mark a field sensitive. */
  extraSensitiveMarkers?: string[];
};

const DEFAULT_CONFIG: Required<
  Pick<PrivacyFilterConfig, 'redactEmail' | 'redactPhone' | 'keepLength'>
> & { extraSensitiveMarkers: string[] } = {
  redactEmail: true,
  redactPhone: true,
  keepLength: false,
  extraSensitiveMarkers: [],
};

function resolveConfig(config?: PrivacyFilterConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    extraSensitiveMarkers: [
      ...DEFAULT_CONFIG.extraSensitiveMarkers,
      ...(config?.extraSensitiveMarkers ?? []),
    ],
  };
}

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

/** Field-name / label / placeholder markers (ES + EN). */
const SENSITIVE_FIELD_MARKERS = [
  'password',
  'passwd',
  'passphrase',
  'contraseña',
  'contrasena',
  'clave',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'client_secret',
  'access_token',
  'refresh_token',
  'cvv',
  'cvc',
  'card number',
  'cardnumber',
  'creditcard',
  'credit card',
  'tarjeta',
  'pan',
  'ssn',
  'rut',
  'run',
  'otp',
  'pin',
] as const;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** Chilean mobile / landline and generic intl-ish phones. */
const PHONE_RE =
  /(?:\+?56\s?)?(?:\(?\d{1,2}\)?[\s.-]?)?\d{4}[\s.-]?\d{4}\b|\b\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g;
/** Chilean RUT with optional dots and hyphen. */
const RUT_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
/** Rough card number (13–19 digits with optional spaces/dashes). */
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const CVV_STANDALONE_RE = /\b\d{3,4}\b/g;
const API_KEYISH_RE =
  /\b(?:sk|pk|rk|ghp|gho|glpat)[_-][A-Za-z0-9]{16,}\b|\b[A-Za-z0-9_-]{32,}\b/g;

export type SensitivityHint = {
  inputType?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  autocomplete?: string;
  selector?: string;
  description?: string;
};

function haystackFromHint(hint: SensitivityHint): string {
  return [
    hint.inputType,
    hint.name,
    hint.id,
    hint.label,
    hint.placeholder,
    hint.ariaLabel,
    hint.autocomplete,
    hint.selector,
    hint.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** True when attributes/labels indicate a sensitive field (password never stored). */
export function isSensitiveField(
  hint: SensitivityHint,
  config?: PrivacyFilterConfig
): boolean {
  const cfg = resolveConfig(config);
  const type = String(hint.inputType ?? '').toLowerCase();
  if (type === 'password') return true;

  const hay = haystackFromHint(hint);
  if (!hay) return false;

  if (SENSITIVE_FIELD_MARKERS.some((m) => hay.includes(m))) return true;
  if (cfg.extraSensitiveMarkers.some((m) => m && hay.includes(m.toLowerCase()))) {
    return true;
  }
  if (/(^|[\s_-])(cc|cvv|cvc)([\s_-]|$)/i.test(hay)) return true;
  return false;
}

export function redactValue(
  value: string,
  config?: PrivacyFilterConfig
): typeof REDACTED | `[REDACTED:${number}]` {
  const cfg = resolveConfig(config);
  if (cfg.keepLength) return `[REDACTED:${value.length}]`;
  return REDACTED;
}

/**
 * Classify + redact a field value for storage in TutorialAction / CaptureStep text.
 * Passwords and sensitive fields always become [REDACTED] (never cleartext).
 */
export function filterFieldValue(
  value: string,
  hint: SensitivityHint,
  config?: PrivacyFilterConfig
): { value: string; sensitive: boolean } {
  if (isSensitiveField(hint, config)) {
    return { value: redactValue(value, config), sensitive: true };
  }
  const scrubbed = scrubPatternsInText(value, config);
  const changed = scrubbed !== value;
  return { value: scrubbed, sensitive: changed };
}

function scrubPatternsInText(raw: string, config?: PrivacyFilterConfig): string {
  const cfg = resolveConfig(config);
  let s = raw;
  s = s.replace(RUT_RE, REDACTED);
  s = s.replace(CARD_RE, (match) => {
    const digits = match.replace(/\D/g, '');
    // Avoid redacting short numeric IDs: require card-like length.
    if (digits.length < 13 || digits.length > 19) return match;
    return REDACTED;
  });
  if (cfg.redactEmail) s = s.replace(EMAIL_RE, REDACTED);
  if (cfg.redactPhone) s = s.replace(PHONE_RE, REDACTED);
  s = s.replace(API_KEYISH_RE, (match) => {
    // Skip ordinary words / short tokens.
    if (match.length < 20) return match;
    if (/^[A-Za-z]+$/.test(match)) return match;
    return REDACTED;
  });
  return s;
}

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

/** Strip OAuth-looking tokens/params and pattern secrets from free text. */
export function sanitizeTutorialText(
  raw: string,
  config?: PrivacyFilterConfig
): string {
  let s = raw.replace(SECRETISH, '$1=[redacted]');
  s = s.replace(/https?:\/\/accounts\.google\.com\S+/gi, '[auth omitted]');
  s = s.replace(/https?:\/\/\S{120,}/g, (match) => {
    if (isSensitiveAuthUrl(match)) return '[auth omitted]';
    return sanitizeTutorialUrl(match);
  });
  s = scrubPatternsInText(s, config);
  // CVV only when nearby context mentions card verification — avoid nuking every "123".
  if (/\b(cvv|cvc|seguridad|security code)\b/i.test(s)) {
    s = s.replace(CVV_STANDALONE_RE, REDACTED);
  }
  return s;
}

/** PrivacyFilter facade matching Prompt Maestro naming. */
export const PrivacyFilter = {
  isSensitiveField,
  filterFieldValue,
  redactValue,
  sanitizeText: sanitizeTutorialText,
  sanitizeUrl: sanitizeTutorialUrl,
  isSensitiveAuthUrl,
} as const;
