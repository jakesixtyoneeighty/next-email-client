import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmailAttachment } from '../lib/db/schema';
import {
  sanitizeHttpsUrl,
  sanitizeLinkUrl,
  tokenizeLinks,
} from '../lib/mail/links';
import {
  isImageAttachment,
  normalizeContentId,
  prepareEmailHtml,
  sanitizeCss,
} from '../lib/mail/sanitize';

test('sanitizeLinkUrl validates allowed schemes and strips unsafe or relative URLs', () => {
  assert.deepEqual(sanitizeLinkUrl('https://example.com/path?a=1&b=2'), {
    href: 'https://example.com/path?a=1&b=2',
    isFragment: false,
    isExternal: true,
  });
  assert.deepEqual(sanitizeLinkUrl('http://example.com/login'), {
    href: 'http://example.com/login',
    isFragment: false,
    isExternal: true,
  });
  assert.deepEqual(sanitizeLinkUrl('//cdn.example.com/file.pdf'), {
    href: 'https://cdn.example.com/file.pdf',
    isFragment: false,
    isExternal: true,
  });
  assert.deepEqual(sanitizeLinkUrl('mailto:team@example.com'), {
    href: 'mailto:team@example.com',
    isFragment: false,
    isExternal: false,
  });
  assert.deepEqual(sanitizeLinkUrl('tel:+15551234567'), {
    href: 'tel:+15551234567',
    isFragment: false,
    isExternal: false,
  });
  assert.deepEqual(sanitizeLinkUrl('  #section-2\n'), {
    href: '#section-2',
    isFragment: true,
    isExternal: false,
  });

  for (const unsafe of [
    '',
    'javascript:alert(1)',
    'ja\tvascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '/relative/path',
    'example.com/no-scheme',
  ]) {
    assert.equal(sanitizeLinkUrl(unsafe), null, `expected null for ${unsafe}`);
  }
});

test('sanitizeHttpsUrl permits only valid https URLs', () => {
  assert.equal(
    sanitizeHttpsUrl('https://cdn.example.com/signed?tok=123'),
    'https://cdn.example.com/signed?tok=123',
  );
  assert.equal(sanitizeHttpsUrl('http://insecure.example.com/file'), null);
  assert.equal(sanitizeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeHttpsUrl('/local/path'), null);
});

test('tokenizeLinks extracts URLs, www domains, mailto, and bare emails cleanly', () => {
  assert.deepEqual(
    tokenizeLinks(
      'Check https://example.com/docs?q=1&v=2, www.example.org/home! Email mailto:hi@example.com or support@example.net.',
    ),
    [
      { type: 'text', value: 'Check ' },
      {
        type: 'link',
        text: 'https://example.com/docs?q=1&v=2',
        href: 'https://example.com/docs?q=1&v=2',
        external: true,
      },
      { type: 'text', value: ', ' },
      {
        type: 'link',
        text: 'www.example.org/home',
        href: 'https://www.example.org/home',
        external: true,
      },
      { type: 'text', value: '! Email ' },
      {
        type: 'link',
        text: 'mailto:hi@example.com',
        href: 'mailto:hi@example.com',
        external: false,
      },
      { type: 'text', value: ' or ' },
      {
        type: 'link',
        text: 'support@example.net',
        href: 'mailto:support@example.net',
        external: false,
      },
      { type: 'text', value: '.' },
    ],
  );

  // Balanced vs unbalanced parentheses + html-to-text brackets + bare "www."
  assert.deepEqual(
    tokenizeLinks(
      'See (https://en.wikipedia.org/wiki/Email_(electronic_mail)). Also [https://example.com/a] and "https://example.com/b"; www. ignored, javascript:alert(1) ignored.',
    ),
    [
      { type: 'text', value: 'See (' },
      {
        type: 'link',
        text: 'https://en.wikipedia.org/wiki/Email_(electronic_mail)',
        href: 'https://en.wikipedia.org/wiki/Email_(electronic_mail)',
        external: true,
      },
      { type: 'text', value: '). Also [' },
      {
        type: 'link',
        text: 'https://example.com/a',
        href: 'https://example.com/a',
        external: true,
      },
      { type: 'text', value: '] and "' },
      {
        type: 'link',
        text: 'https://example.com/b',
        href: 'https://example.com/b',
        external: true,
      },
      {
        type: 'text',
        value: '"; www. ignored, javascript:alert(1) ignored.',
      },
    ],
  );
});

test('normalizeContentId and isImageAttachment handle real-world metadata', () => {
  assert.equal(normalizeContentId('  <Logo@Example.COM> '), 'logo@example.com');
  assert.equal(
    normalizeContentId('CID:%3Cimage001.png%4001DA.1234%3E'),
    'image001.png@01da.1234',
  );

  assert.equal(
    isImageAttachment({ filename: 'photo', contentType: 'image/png' }),
    true,
  );
  assert.equal(
    isImageAttachment({
      filename: 'photo.jpg',
      contentType: 'image/jpeg; charset=binary',
    }),
    true,
  );
  assert.equal(
    isImageAttachment({ filename: 'photo.webp', contentType: null }),
    true,
  );
  assert.equal(
    isImageAttachment({ filename: 'vector.svg', contentType: 'image/svg+xml' }),
    false,
  );
  assert.equal(
    isImageAttachment({
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    }),
    false,
  );
});

test('sanitizeCss removes dangerous constructs and rewrites url() calls', () => {
  const cleaned = sanitizeCss(
    `/* comment */ @import url("https://evil.test/a.css");
    div > p { position: fixed; color: red; background-image: url("https://cdn.example.com/bg.png"); }
    .bad { background: url("javascript:alert(1)"); behavior: url(x.htc); -moz-binding: url(y.xml); width: expression(alert(1)); }
    .break { content: "</style><script>alert(1)</script>"; }`,
    (raw) => (raw.startsWith('https://') ? raw : null),
  );

  assert.doesNotMatch(
    cleaned,
    /comment|@import|javascript:|expression|behavior|-moz-binding|<\/style|<script/i,
  );
  assert.match(cleaned, /position:\s*static/);
  assert.match(cleaned, /div > p/);
  assert.match(cleaned, /url\("https:\/\/cdn\.example\.com\/bg\.png"\)/);
  assert.match(cleaned, /background:\s*none/);
});

test('prepareEmailHtml handles remote/data images, cid resolution, links, and XSS defenses', () => {
  const attachments: EmailAttachment[] = [
    {
      id: 'att-cid-1',
      filename: 'header-logo.png',
      size: 2048,
      contentType: 'image/png',
      contentId: '<Logo@Example.COM>',
      contentDisposition: 'inline',
    },
    {
      id: 'att-fallback-2',
      filename: 'diagram.png',
      size: 4096,
      contentType: 'image/png',
      contentId: null,
      contentDisposition: 'inline',
    },
    {
      id: 'att-bg-3',
      filename: 'tile.jpg',
      size: 1024,
      contentType: 'image/jpeg',
      contentId: '<tile@bg>',
      contentDisposition: 'inline',
    },
    {
      id: 'att-unused-4',
      filename: 'receipt.pdf',
      size: 9000,
      contentType: 'application/pdf',
      contentId: null,
      contentDisposition: 'attachment',
    },
  ];

  const signedUrls = new Map<string, string>([
    ['att-cid-1', 'https://signed.resend.test/header-logo.png?sig=1'],
  ]);

  const html = `
    <!--[if mso]><style>.mso-only { color: pink; }</style><![endif]-->
    <head>
      <title>Secret Title Leak</title>
      <base href="https://evil.example/" />
      <meta http-equiv="refresh" content="0;url=https://evil.example/" />
      <style>
        .card > p { color: #222222; background-image: url("cid:tile@bg"); }
        .evil { background: url("javascript:alert(1)"); }
        .break { content: "</style><script>alert(1)</script>"; }
      </style>
    </head>
    <body bgcolor="#fafafa" text="#111111" style="font-family: Georgia, serif; height: 100vh; margin: 40px; padding: 20px; overflow: hidden;">
      <script>alert('xss')</script>
      <iframe src="https://evil.example"></iframe>
      <form action="https://evil.example"><input name="x" /></form>
      <xml><secret>hidden xml text</secret></xml>
      <div class="card" onclick="alert(1)">
        <img src="cid:%3Clogo@example.com%3E" srcset="https://evil.test/2x.png 2x" alt="Logo" />
        <img src="cid:diagram.png@01DA1234" alt="Diagram" />
        <img src="https://cdn.example.com/hero.jpg" alt="Hero" />
        <img src="//cdn.example.com/proto.png" alt="Proto" />
        <img src="data:image/png;base64,iVBORw0KGgo=" alt="DataPNG" />
        <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="BlockedSVG" />
        <img src="javascript:alert(1)" alt="BlockedJS" />
        <table background="cid:tile@bg"><tr><td>Table</td></tr></table>
        <p>Visit https://example.com/welcome?a=1&amp;b=2 or email hello@example.org.</p>
        <p><a href="https://example.com/cta">CTA</a> <a href="#top">Top</a> <a href="/local">Rel</a> <a href="javascript:alert(2)">Bad</a></p>
        <p><code>https://example.com/in-code</code></p>
        <pre>https://example.com/in-pre</pre>
      </div>
    </body>
  `;

  const { srcDoc, usedInlineAttachmentIds } = prepareEmailHtml({
    emailId: 42,
    html,
    attachments,
    signedUrls,
  });

  // Inline attachments used in <img>, fallback prefix, and CSS/HTML background
  assert.deepEqual(Array.from(usedInlineAttachmentIds).sort(), [
    'att-bg-3',
    'att-cid-1',
    'att-fallback-2',
  ]);

  // CSP + no-referrer meta
  assert.match(srcDoc, /<meta name="referrer" content="no-referrer" \/>/);
  assert.match(srcDoc, /script-src 'none'/);

  // Signed URL, fallback /api/attachments URL, remote, protocol-relative upgrade, data PNG
  assert.match(
    srcDoc,
    /src="https:\/\/signed\.resend\.test\/header-logo\.png\?sig=1"/,
  );
  assert.match(srcDoc, /src="\/api\/attachments\/42\/att-fallback-2"/);
  assert.match(srcDoc, /src="https:\/\/cdn\.example\.com\/hero\.jpg"/);
  assert.match(srcDoc, /src="https:\/\/cdn\.example\.com\/proto\.png"/);
  assert.match(srcDoc, /src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(srcDoc, /referrerpolicy="no-referrer"/);

  // Blocked SVG data URL, javascript image src, srcset stripped
  assert.doesNotMatch(srcDoc, /data:image\/svg\+xml/);
  assert.doesNotMatch(srcDoc, /srcset=/);
  assert.doesNotMatch(srcDoc, /javascript:/);

  // CSS and HTML background cid resolution
  assert.match(srcDoc, /\.card > p/);
  assert.match(srcDoc, /url\("\/api\/attachments\/42\/att-bg-3"\)/);
  assert.match(srcDoc, /background="\/api\/attachments\/42\/att-bg-3"/);

  // Body attributes preserved without layout-breaking height/margin/padding/overflow
  assert.match(
    srcDoc,
    /<body style="background-color: #fafafa; color: #111111; font-family: Georgia, serif">/,
  );

  // Links: external get target="_blank" rel="noopener noreferrer", #top keeps href without target, relative/javascript hrefs stripped
  assert.match(
    srcDoc,
    /<a href="https:\/\/example\.com\/cta" target="_blank" rel="noopener noreferrer">CTA<\/a>/,
  );
  assert.match(srcDoc, /<a href="#top">Top<\/a>/);
  assert.match(srcDoc, /<a>Rel<\/a> <a>Bad<\/a>/);

  // Auto-linkification of bare URLs/emails in <p>, but not inside <code>/<pre>
  assert.match(
    srcDoc,
    /<a href="https:\/\/example\.com\/welcome\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https:\/\/example\.com\/welcome\?a=1&amp;b=2<\/a>/,
  );
  assert.match(
    srcDoc,
    /<a href="mailto:hello@example\.org" target="_blank" rel="noopener noreferrer">hello@example\.org<\/a>/,
  );
  assert.match(srcDoc, /<code>https:\/\/example\.com\/in-code<\/code>/);
  assert.match(srcDoc, /<pre>https:\/\/example\.com\/in-pre<\/pre>/);

  // XSS / metadata / MSO conditional stripping
  assert.doesNotMatch(
    srcDoc,
    /<script|<iframe|<form|<base|http-equiv="refresh"|onclick=/i,
  );
  assert.doesNotMatch(srcDoc, /Secret Title Leak|hidden xml text|mso-only/);
});
