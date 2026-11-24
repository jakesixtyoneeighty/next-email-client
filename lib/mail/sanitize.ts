import * as htmlparser2 from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';
import type { EmailAttachment } from '../db/schema';
import { sanitizeLinkUrl, tokenizeLinks } from './links';

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;
const SAFE_DATA_IMAGE_RE =
  /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
const IMAGE_CONTENT_TYPE_RE = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i;
const IMAGE_FILENAME_RE = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const COLOR_ATTR_RE = /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i;

const UNSAFE_STYLE_ANCESTORS = new Set([
  'script',
  'noscript',
  'template',
  'textarea',
  'svg',
  'xml',
  'title',
  'iframe',
  'object',
  'embed',
  'math',
]);

const BODY_STRIP_STYLE_PROPS = new Set([
  'height',
  'min-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'overflow',
  'overflow-x',
  'overflow-y',
]);

const ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'br',
  'hr',
  'wbr',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'nav',
  'aside',
  'address',
  'center',
  'figure',
  'figcaption',
  'details',
  'summary',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'kbd',
  'samp',
  'var',
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'abbr',
  'cite',
  'q',
  'time',
  'font',
  'big',
  'tt',
  'bdi',
  'bdo',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'img',
  'picture',
  'map',
  'area',
];

const NON_TEXT_TAGS = [
  'style',
  'script',
  'textarea',
  'option',
  'noscript',
  'title',
  'xml',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  '*': [
    'style',
    'class',
    'id',
    'dir',
    'lang',
    'title',
    'align',
    'valign',
    'bgcolor',
    'color',
    'width',
    'height',
    'role',
  ],
  table: ['border', 'cellpadding', 'cellspacing', 'background', 'summary'],
  td: ['colspan', 'rowspan', 'nowrap', 'background', 'scope', 'headers'],
  th: ['colspan', 'rowspan', 'nowrap', 'background', 'scope', 'headers'],
  tr: ['background'],
  tbody: ['background'],
  thead: ['background'],
  tfoot: ['background'],
  col: ['span'],
  colgroup: ['span'],
  a: ['href', 'name', 'target', 'rel'],
  area: ['href', 'alt', 'coords', 'shape', 'target', 'rel'],
  map: ['name'],
  img: ['src', 'alt', 'border', 'hspace', 'vspace', 'usemap', 'referrerpolicy'],
  font: ['face', 'size', 'color'],
  ol: ['start', 'type', 'reversed'],
  li: ['value'],
  details: ['open'],
  time: ['datetime'],
  blockquote: ['cite'],
  q: ['cite'],
};

const SKIP_LINKIFY_TAGS = new Set(['a', 'code', 'pre']);
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Normalizes a Content-ID header or `cid:` URI reference for matching.
 */
export function normalizeContentId(value: string): string {
  let normalized = value.replace(CONTROL_CHARS_RE, '').trim();
  if (/^cid:/i.test(normalized)) {
    normalized = normalized.slice(4);
  }
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep raw value if percent-encoding is malformed.
  }
  normalized = normalized.trim().replace(/^<+|>+$/g, '').trim();
  return normalized.toLowerCase();
}

/**
 * Returns true if an attachment is a safe raster image type suitable for inline preview.
 */
export function isImageAttachment(
  att: Pick<EmailAttachment, 'filename' | 'contentType'>,
): boolean {
  if (att.contentType) {
    return IMAGE_CONTENT_TYPE_RE.test(att.contentType.split(';')[0].trim());
  }
  return IMAGE_FILENAME_RE.test(att.filename);
}

/**
 * Sanitizes CSS text from `<style>` blocks and inline `style` attributes,
 * stripping dangerous directives and resolving/filtering `url(...)` references.
 */
export function sanitizeCss(
  css: string,
  resolveImageUrl: (raw: string) => string | null,
): string {
  let cleaned = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/</g, '')
    .replace(/@import\b[^;]*(;|$)/gi, '')
    .replace(/(^|[;{])\s*(?:behavior|-moz-binding)\s*:[^;}]*;?/gi, '$1')
    .replace(
      /(^|[;{])\s*[^;{}]*?:\s*[^;{}]*?\bexpression\s*\([^;{}]*;?/gi,
      '$1',
    )
    .replace(/\bexpression\s*\(/gi, 'blocked(')
    .replace(/\b(?:behavior|-moz-binding)\s*:/gi, 'x-blocked:')
    .replace(/position\s*:\s*fixed\b/gi, 'position: static');

  cleaned = cleaned.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi,
    (_, dq: string | undefined, sq: string | undefined, uq: string | undefined) => {
      const rawUrl = (dq ?? sq ?? uq ?? '').trim();
      const resolved = resolveImageUrl(rawUrl);
      if (!resolved) return 'none';
      return `url("${resolved.replace(/"/g, '%22')}")`;
    },
  );

  return cleaned.trim();
}

function splitCssDeclarations(style: string): string[] {
  const declarations: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;

  for (let i = 0; i < style.length; i++) {
    const ch = style[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < style.length) {
        current += style[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
      current += ch;
    } else if (ch === ';' && parenDepth === 0) {
      if (current.trim()) declarations.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) declarations.push(current.trim());
  return declarations;
}

function stripBodyLayoutDeclarations(style: string): string {
  return splitCssDeclarations(style)
    .filter((decl) => {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) return false;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      return !BODY_STRIP_STYLE_PROPS.has(prop);
    })
    .join('; ');
}

function extractHeadStylesAndBodyAttrs(
  html: string,
  resolveImageUrl: (raw: string) => string | null,
): { styles: string[]; bodyStyle: string } {
  const styles: string[] = [];
  const tagStack: string[] = [];
  let inSafeStyle = false;
  let currentStyleChunks: string[] = [];
  let bodyAttrs: Record<string, string> | null = null;

  const parser = new htmlparser2.Parser(
    {
      onopentag(name, attribs) {
        const lower = name.toLowerCase();
        if (lower === 'body' && !bodyAttrs) {
          bodyAttrs = { ...attribs };
        }
        if (
          lower === 'style' &&
          !tagStack.some((ancestor) => UNSAFE_STYLE_ANCESTORS.has(ancestor))
        ) {
          inSafeStyle = true;
          currentStyleChunks = [];
        }
        tagStack.push(lower);
      },
      ontext(text) {
        if (inSafeStyle) {
          currentStyleChunks.push(text);
        }
      },
      onclosetag() {
        const closed = tagStack.pop();
        if (closed === 'style' && inSafeStyle) {
          inSafeStyle = false;
          const sanitized = sanitizeCss(
            currentStyleChunks.join(''),
            resolveImageUrl,
          );
          if (sanitized) styles.push(sanitized);
          currentStyleChunks = [];
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  const bodyParts: string[] = [];
  if (bodyAttrs) {
    const attrs = bodyAttrs as Record<string, string>;
    const bgcolor = attrs.bgcolor?.trim();
    if (bgcolor && COLOR_ATTR_RE.test(bgcolor)) {
      bodyParts.push(`background-color: ${bgcolor}`);
    }
    const text = attrs.text?.trim();
    if (text && COLOR_ATTR_RE.test(text)) {
      bodyParts.push(`color: ${text}`);
    }
    if (attrs.style) {
      const sanitizedBodyCss = stripBodyLayoutDeclarations(
        sanitizeCss(attrs.style, resolveImageUrl),
      );
      if (sanitizedBodyCss) {
        bodyParts.push(sanitizedBodyCss);
      }
    }
  }

  return {
    styles,
    bodyStyle: bodyParts.join('; '),
  };
}

function linkifySanitizedHtml(html: string): string {
  const output: string[] = [];
  let pendingText = '';
  let skipDepth = 0;

  const flushText = () => {
    if (!pendingText) return;
    if (skipDepth > 0) {
      output.push(escapeText(pendingText));
    } else {
      for (const token of tokenizeLinks(pendingText)) {
        if (token.type === 'text') {
          output.push(escapeText(token.value));
        } else if (token.external) {
          output.push(
            `<a href="${escapeAttr(token.href)}" target="_blank" rel="noopener noreferrer">${escapeText(token.text)}</a>`,
          );
        } else {
          output.push(
            `<a href="${escapeAttr(token.href)}">${escapeText(token.text)}</a>`,
          );
        }
      }
    }
    pendingText = '';
  };

  const parser = new htmlparser2.Parser(
    {
      onopentag(name, attribs) {
        flushText();
        const lower = name.toLowerCase();
        if (SKIP_LINKIFY_TAGS.has(lower)) {
          skipDepth++;
        }
        let attrs = '';
        for (const [key, value] of Object.entries(attribs)) {
          attrs += ` ${key}="${escapeAttr(value)}"`;
        }
        output.push(`<${lower}${attrs}>`);
      },
      ontext(text) {
        pendingText += text;
      },
      onclosetag(name) {
        flushText();
        const lower = name.toLowerCase();
        if (SKIP_LINKIFY_TAGS.has(lower) && skipDepth > 0) {
          skipDepth--;
        }
        if (!VOID_TAGS.has(lower)) {
          output.push(`</${lower}>`);
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();
  flushText();

  return output.join('');
}

/**
 * Sanitizes an untrusted HTML email, resolves `cid:` inline images,
 * auto-linkifies bare URLs and email addresses, and builds a self-contained
 * `srcDoc` HTML document with strict CSP and `no-referrer` policies.
 */
export function prepareEmailHtml({
  emailId,
  html,
  attachments,
  signedUrls,
}: {
  emailId: number;
  html: string;
  attachments: EmailAttachment[];
  signedUrls?: Map<string, string>;
}): { srcDoc: string; usedInlineAttachmentIds: Set<string> } {
  const usedInlineAttachmentIds = new Set<string>();
  const byCid = new Map<string, EmailAttachment>();
  const byFilename = new Map<string, EmailAttachment>();

  for (const att of attachments) {
    if (att.contentId) {
      const normalizedCid = normalizeContentId(att.contentId);
      if (normalizedCid && !byCid.has(normalizedCid)) {
        byCid.set(normalizedCid, att);
      }
    }
    if (att.filename) {
      const normalizedName = att.filename.trim().toLowerCase();
      if (normalizedName && !byFilename.has(normalizedName)) {
        byFilename.set(normalizedName, att);
      }
    }
  }

  const findAttachmentByCid = (rawCid: string): EmailAttachment | undefined => {
    const normalized = normalizeContentId(rawCid);
    if (!normalized) return undefined;

    const exact = byCid.get(normalized);
    if (exact) return exact;

    const byName = byFilename.get(normalized);
    if (byName) return byName;

    const atIndex = normalized.indexOf('@');
    if (atIndex > 0) {
      const prefix = normalized.slice(0, atIndex);
      return byFilename.get(prefix);
    }

    return undefined;
  };

  const resolveImageUrl = (raw: string): string | null => {
    const cleaned = raw.replace(CONTROL_CHARS_RE, '').trim();
    if (!cleaned) return null;

    if (/^cid:/i.test(cleaned)) {
      const attachment = findAttachmentByCid(cleaned);
      if (!attachment) return null;
      usedInlineAttachmentIds.add(attachment.id);
      return (
        signedUrls?.get(attachment.id) ||
        `/api/attachments/${emailId}/${attachment.id}`
      );
    }

    if (/^data:/i.test(cleaned)) {
      if (!SAFE_DATA_IMAGE_RE.test(cleaned)) return null;
      return cleaned.replace(/\s+/g, '');
    }

    const candidate = cleaned.startsWith('//') ? `https:${cleaned}` : cleaned;
    try {
      const parsed = new URL(candidate);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.hostname
      ) {
        return parsed.toString();
      }
    } catch {
      return null;
    }

    return null;
  };

  const { styles, bodyStyle } = extractHeadStylesAndBodyAttrs(
    html,
    resolveImageUrl,
  );

  const transformAnchorTag = (
    tagName: string,
    attribs: sanitizeHtml.Attributes,
  ) => {
    const next = { ...attribs };
    const valid = next.href ? sanitizeLinkUrl(next.href) : null;
    if (!valid) {
      delete next.href;
      delete next.target;
      delete next.rel;
    } else if (valid.isFragment) {
      next.href = valid.href;
      delete next.target;
      delete next.rel;
    } else {
      next.href = valid.href;
      next.target = '_blank';
      next.rel = 'noopener noreferrer';
    }
    return { tagName, attribs: next };
  };

  const sanitizedHtml = sanitizeHtml(html, {
    allowVulnerableTags: false,
    allowedTags: ALLOWED_TAGS,
    nonTextTags: NON_TEXT_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowProtocolRelative: false,
    allowedEmptyAttributes: ['alt', 'open', 'reversed', 'nowrap'],
    transformTags: {
      '*': (tagName, attribs) => {
        const next = { ...attribs };

        if (next.style) {
          const cleanedCss = sanitizeCss(next.style, resolveImageUrl);
          if (cleanedCss) {
            next.style = cleanedCss;
          } else {
            delete next.style;
          }
        }

        if (next.background !== undefined) {
          const resolvedBg = resolveImageUrl(next.background);
          if (resolvedBg) {
            next.background = resolvedBg;
          } else {
            delete next.background;
          }
        }

        if (next.cite !== undefined) {
          const validCite = sanitizeLinkUrl(next.cite);
          if (validCite && !validCite.isFragment) {
            next.cite = validCite.href;
          } else {
            delete next.cite;
          }
        }

        return { tagName, attribs: next };
      },
      a: transformAnchorTag,
      area: transformAnchorTag,
      img: (tagName, attribs) => {
        const next = { ...attribs };
        const resolved = next.src ? resolveImageUrl(next.src) : null;
        if (resolved) {
          next.src = resolved;
        } else {
          delete next.src;
        }
        next.referrerpolicy = 'no-referrer';
        delete next.srcset;
        return { tagName, attribs: next };
      },
    },
  });

  const linkifiedHtml = linkifySanitizedHtml(sanitizedHtml);

  const csp =
    "default-src 'none'; img-src https: http: data: 'self'; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none';";

  const baseCss = [
    'html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }',
    "body { overflow-x: auto; overflow-y: hidden; background: #ffffff; color: #18181b; color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; overflow-wrap: break-word; word-wrap: break-word; }",
    'a { color: #1d4ed8; text-decoration: underline; text-underline-offset: 2px; }',
    'a img { border: 0; }',
    'img { max-width: 100%; height: auto; }',
    'pre, code { white-space: pre-wrap; word-break: break-word; }',
    'blockquote { margin: 12px 0; padding-left: 14px; border-left: 3px solid #d4d4d8; color: #52525b; }',
    '#mail-root { display: flow-root; padding: 18px 20px; box-sizing: border-box; min-width: 0; }',
    '@media (max-width: 600px) { #mail-root { padding: 14px 16px; } }',
  ].join('\n');

  const emailStyleTags = styles
    .map((block) => `<style>${block}</style>`)
    .join('\n');

  const bodyStyleAttr = bodyStyle ? ` style="${escapeAttr(bodyStyle)}"` : '';

  const srcDoc = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="referrer" content="no-referrer" />',
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}" />`,
    `<style>${baseCss}</style>`,
    emailStyleTags,
    '</head>',
    `<body${bodyStyleAttr}><div id="mail-root">${linkifiedHtml}</div></body>`,
    '</html>',
  ]
    .filter(Boolean)
    .join('');

  return { srcDoc, usedInlineAttachmentIds };
}
