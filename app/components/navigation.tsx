'use client';

import { authClient } from '@/lib/auth-client';
import {
  Archive,
  FileText,
  Inbox,
  LogOut,
  Menu,
  PenLine,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const folders = [
  { name: 'Inbox', path: 'inbox', icon: Inbox },
  { name: 'Starred', path: 'starred', icon: Star },
  { name: 'Drafts', path: 'drafts', icon: FileText },
  { name: 'Sent', path: 'sent', icon: Send },
  { name: 'Archive', path: 'archive', icon: Archive },
  { name: 'Trash', path: 'trash', icon: Trash2 },
];

export function Navigation({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="mobile-bar">
        <Link href="/f/inbox" className="wordmark">
          sixty<span>one</span>eighty
        </Link>
        <button
          className="icon-button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mail-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="mail-navigation"
        className={`navigation ${open ? 'is-open' : ''}`}
      >
        <Link
          href="/f/inbox"
          className="brand"
          aria-label="sixtyoneeighty mail home"
        >
          <span className="wordmark">
            sixty<span>one</span>eighty
          </span>
          <span className="brand-caption">MAIL</span>
        </Link>
        <Link href="/f/inbox/new" className="compose-button">
          <PenLine size={18} /> Compose
        </Link>
        <nav aria-label="Mail folders">
          {folders.map(({ name, path, icon: Icon }) => {
            const active = pathname.startsWith(`/f/${path}`);
            return (
              <Link
                key={path}
                href={`/f/${path}`}
                className={`folder-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={1.6} />
                <span>{name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="nav-bottom">
          <button
            className="folder-link"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign('/login');
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
          <Image
            src="/brand/sixtyoneeighty.png"
            alt="sixtyoneeighty"
            width={1445}
            height={1088}
            className="brand-art"
            loading="eager"
            sizes="(min-width: 1500px) 236px, 204px"
          />
          <div className="workspace-label">
            <span className="workspace-dot" />
            <div>
              {email}
              <span>Mail workspace</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
