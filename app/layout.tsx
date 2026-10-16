import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { Navigation } from './components/navigation';
import { RightSidebar } from './components/right-sidebar';
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
        <Suspense>
          <Navigation />
        </Suspense>
        <main id="main-content" className="mail-main">
          {children}
        </main>
        <Suspense
          fallback={
            <aside className="profile-sidebar" aria-label="Loading profile" />
          }
        >
          <RightSidebar userId={1} />
        </Suspense>
        <Toaster theme="dark" closeButton />
      </body>
    </html>
  );
}
