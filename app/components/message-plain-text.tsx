import { tokenizeLinks } from '@/lib/mail/links';

export function MessagePlainText({ text }: { text: string }) {
  const tokens = tokenizeLinks(text);
  return (
    <div className="message-body">
      {tokens.map((token, index) =>
        token.type === 'text' ? (
          token.value
        ) : (
          <a
            key={index}
            href={token.href}
            target={token.external ? '_blank' : undefined}
            rel={token.external ? 'noopener noreferrer' : undefined}
          >
            {token.text}
          </a>
        ),
      )}
    </div>
  );
}
