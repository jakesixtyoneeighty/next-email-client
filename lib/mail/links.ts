export type SanitizedLink = {
  href: string;
  isFragment: boolean;
  isExternal: boolean;
};

export type LinkToken =
  | { type: 'text'; value: string }
  | { type: 'link'; text: string; href: string; external: boolean };

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const LINK_TOKEN_RE =
  /(https?:\/\/[^\s<>"{}|\\^\[\]`]+)|(mailto:[^\s<>"{}|\\^\[\]`]+)|((?<![\w@/.])www\.[^\s<>"{}|\\^\[\]`]+)|((?<![\w.+\-/])[\w.+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}\b)/gi;

const TRAILING_PUNCTUATION_RE = /[.,;:!?'"\}>\]\)]$/;

export function sanitizeHttpsUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && parsed.hostname
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Validates and normalizes an anchor href or plain-text URL candidate.
 * Only permits safe navigation protocols (`http`, `https`, `mailto`, `tel`)
 * and in-document `#fragment` references.
 */
export function sanitizeLinkUrl(raw: string): SanitizedLink | null {
  const cleaned = raw.replace(CONTROL_CHARS_RE, '').trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('#')) {
    return {
      href: cleaned,
      isFragment: true,
      isExternal: false,
    };
  }

  const candidate = cleaned.startsWith('//') ? `https:${cleaned}` : cleaned;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
    return null;
  }

  if (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    !parsed.hostname
  ) {
    return null;
  }

  return {
    href: parsed.toString(),
    isFragment: false,
    isExternal: EXTERNAL_PROTOCOLS.has(parsed.protocol),
  };
}

function splitTrailingPunctuation(raw: string): {
  value: string;
  trailing: string;
} {
  let value = raw;
  let trailing = '';

  while (value.length > 0 && TRAILING_PUNCTUATION_RE.test(value)) {
    const lastChar = value[value.length - 1];
    if (lastChar === ')') {
      let openCount = 0;
      let closeCount = 0;
      for (const ch of value) {
        if (ch === '(') openCount++;
        else if (ch === ')') closeCount++;
      }
      if (closeCount <= openCount) {
        break;
      }
    }
    trailing = lastChar + trailing;
    value = value.slice(0, -1);
  }

  return { value, trailing };
}

function pushText(tokens: LinkToken[], text: string) {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === 'text') {
    last.value += text;
  } else {
    tokens.push({ type: 'text', value: text });
  }
}

/**
 * Splits plain text into alternating literal text and validated link tokens.
 */
export function tokenizeLinks(text: string): LinkToken[] {
  if (!text) return [];

  const tokens: LinkToken[] = [];
  let cursor = 0;
  LINK_TOKEN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = LINK_TOKEN_RE.exec(text)) !== null) {
    const rawMatch = match[0];
    const start = match.index;

    if (start > cursor) {
      pushText(tokens, text.slice(cursor, start));
    }

    const isBareEmail = Boolean(match[4]);
    const isWww = Boolean(match[3]);

    const { value, trailing } = isBareEmail
      ? { value: rawMatch, trailing: '' }
      : splitTrailingPunctuation(rawMatch);

    let candidateHref = value;
    if (isWww) {
      candidateHref = `https://${value}`;
    } else if (isBareEmail) {
      candidateHref = `mailto:${value}`;
    }

    const sanitized = value ? sanitizeLinkUrl(candidateHref) : null;
    const validWww =
      !isWww ||
      (sanitized !== null &&
        /^https:\/\/www\.[^.]+\.[^.]+/i.test(sanitized.href));

    if (sanitized && validWww) {
      tokens.push({
        type: 'link',
        text: value,
        href: sanitized.href,
        external: sanitized.isExternal,
      });
      if (trailing) {
        pushText(tokens, trailing);
      }
    } else {
      pushText(tokens, rawMatch);
    }

    cursor = start + rawMatch.length;
  }

  if (cursor < text.length) {
    pushText(tokens, text.slice(cursor));
  }

  return tokens;
}
