# sixtyoneeighty Mail

A modern mail workspace built with Next.js 16.4.2, React 19.3.1, Postgres, Drizzle, and Tailwind CSS 4. The interface uses sixtyoneeighty’s original black, white, and red artwork across the navigation, favicon, Apple touch icon, and web app manifest.

## Run locally

Use Node.js 20.9 or newer (Node 24 LTS recommended) and pnpm 12.4.1.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. Without a database, the app displays a branded setup state. It does not substitute sample data for your mailbox.

To configure a local Postgres database:

```sh
pnpm db:setup
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The setup script creates `.env` with `POSTGRES_URL`. Migrations create the schema; seeding inserts the original template's example contacts and conversations. Seed only a fresh development database. Restart the app after changing the connection, and provide the same database configuration during production build and runtime.

## What works

- Responsive folder navigation, inbox, search, conversation reader, and compose view.
- Search across names, email addresses, subjects, and message bodies, including literal punctuation.
- Create local messages and view them in Sent; archive conversations or move them to Trash.
- Immediate cache invalidation after message changes with Next.js Cache Components.
- Keyboard focus styles, skip link, labelled controls, mobile navigation, and reduced-motion support.

## Current template boundaries

This is a single-workspace email-client template. It is not connected to an email provider: **Save to sent writes to Postgres and does not deliver external email**. There is no authentication or mailbox synchronization; the profile and sender still use user ID 1. The original Vercel production write restriction is retained. Do not expose a database containing private mail without adding authentication and per-user authorization.

Starred maps to the existing `Flagged` database folder. Drafts can display stored folder content, but composing does not autosave drafts. Scheduling, attachments, and starring controls are not implemented and are not presented as working actions.

## Validation and maintenance

```sh
pnpm typecheck
pnpm build
pnpm format:check
```

The upgrade replaces the old `experimental.ppr` / `dynamicIO` settings with `cacheComponents` and `partialPrefetching`. Fonts are served locally through the existing Geist package, so builds do not depend on Google Fonts.

The source artwork is `public/brand/sixtyoneeighty.png`. Regenerate the favicon, Apple icon, and manifest icon with:

```sh
pnpm brand:icons
```

Original foundation: [leerob/next-email-client](https://github.com/leerob/next-email-client).
