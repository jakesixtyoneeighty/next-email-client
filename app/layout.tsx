import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mail — sixtyoneeighty', template: '%s — sixtyoneeighty' },
  description:
    'Your conversations, in one place. The sixtyoneeighty mail workspace.',
  applicationName: 'sixtyoneeighty Mail',
  icons: { icon: '/favicon.ico', apple: '/apple-icon.png' },
};
export const viewport: Viewport = {
  themeColor: '#0b0b0d',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${GeistSans.className}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to mail
        </a>
        {children}
        <Toaster theme="dark" closeButton />
      </body>
    </html>
  );
}
