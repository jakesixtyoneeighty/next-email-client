import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const mailSchema = pgSchema('mail');

export const users = mailSchema.table(
  'users',
  {
    id: serial('id').primaryKey(),
    firstName: varchar('first_name', { length: 50 }),
    lastName: varchar('last_name', { length: 50 }),
    email: varchar('email', { length: 255 }).notNull(),
    jobTitle: varchar('job_title', { length: 100 }),
    company: varchar('company', { length: 100 }),
    location: varchar('location', { length: 100 }),
    twitter: varchar('twitter', { length: 100 }),
    linkedin: varchar('linkedin', { length: 100 }),
    github: varchar('github', { length: 100 }),
    avatarUrl: varchar('avatar_url', { length: 255 }),
  },
  (table) => {
    return {
      emailIndex: uniqueIndex('email_idx').on(table.email),
    };
  },
);

export const authUser = mailSchema.table('auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const session = mailSchema.table(
  'auth_session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);
export const account = mailSchema.table(
  'auth_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('account_user_idx').on(t.userId),
    uniqueIndex('account_provider_idx').on(t.providerId, t.accountId),
  ],
);
export const verification = mailSchema.table(
  'auth_verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);
export const rateLimit = mailSchema.table('auth_rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
export const mailboxes = mailSchema.table('mailboxes', {
  id: serial('id').primaryKey(),
  authUserId: text('auth_user_id')
    .notNull()
    .unique()
    .references(() => authUser.id),
  contactId: integer('contact_id')
    .notNull()
    .references(() => users.id),
  email: text('email').notNull().unique(),
  recoveryEmail: text('recovery_email').notNull(),
});

export const threads = mailSchema.table('threads', {
  id: serial('id').primaryKey(),
  mailboxId: integer('mailbox_id')
    .notNull()
    .references(() => mailboxes.id),
  subject: varchar('subject', { length: 255 }),
  lastActivityDate: timestamp('last_activity_date').defaultNow(),
});

export const emails = mailSchema.table(
  'emails',
  {
    id: serial('id').primaryKey(),
    threadId: integer('thread_id').references(() => threads.id),
    senderId: integer('sender_id').references(() => users.id),
    recipientId: integer('recipient_id').references(() => users.id),
    subject: varchar('subject', { length: 255 }),
    body: text('body'),
    providerId: text('provider_id'),
    recipientAddress: text('recipient_address'),
    replyTo: text('reply_to'),
    attachments: jsonb('attachments')
      .$type<{ id: string; filename: string; size: number }[]>()
      .notNull()
      .default([]),
    sentDate: timestamp('sent_date').defaultNow(),
  },
  (table) => {
    return {
      threadIdIndex: index('thread_id_idx').on(table.threadId),
      senderIdIndex: index('sender_id_idx').on(table.senderId),
      recipientIdIndex: index('recipient_id_idx').on(table.recipientId),
      sentDateIndex: index('sent_date_idx').on(table.sentDate),
    };
  },
);

export const receipts = mailSchema.table(
  'receipts',
  {
    id: serial('id').primaryKey(),
    providerId: text('provider_id').notNull(),
    mailboxId: integer('mailbox_id')
      .notNull()
      .references(() => mailboxes.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('receipt_mailbox_idx').on(t.providerId, t.mailboxId)],
);
export const outbox = mailSchema.table('outbox', {
  id: text('id').primaryKey(),
  mailboxId: integer('mailbox_id')
    .notNull()
    .references(() => mailboxes.id),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('pending'),
  providerId: text('provider_id'),
  threadId: integer('thread_id').references(() => threads.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const folders = mailSchema.table('folders', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
});

export const userFolders = mailSchema.table('user_folders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  folderId: integer('folder_id').references(() => folders.id),
});

export const threadFolders = mailSchema.table('thread_folders', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').references(() => threads.id),
  folderId: integer('folder_id').references(() => folders.id),
});

export const usersRelations = relations(users, ({ many }) => ({
  sentEmails: many(emails, { relationName: 'sender' }),
  receivedEmails: many(emails, { relationName: 'recipient' }),
  userFolders: many(userFolders),
}));

export const threadsRelations = relations(threads, ({ many }) => ({
  emails: many(emails),
  threadFolders: many(threadFolders),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  thread: one(threads, {
    fields: [emails.threadId],
    references: [threads.id],
  }),
  sender: one(users, {
    fields: [emails.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  recipient: one(users, {
    fields: [emails.recipientId],
    references: [users.id],
    relationName: 'recipient',
  }),
}));

export const foldersRelations = relations(folders, ({ many }) => ({
  userFolders: many(userFolders),
  threadFolders: many(threadFolders),
}));

export const userFoldersRelations = relations(userFolders, ({ one }) => ({
  user: one(users, { fields: [userFolders.userId], references: [users.id] }),
  folder: one(folders, {
    fields: [userFolders.folderId],
    references: [folders.id],
  }),
}));

export const threadFoldersRelations = relations(threadFolders, ({ one }) => ({
  thread: one(threads, {
    fields: [threadFolders.threadId],
    references: [threads.id],
  }),
  folder: one(folders, {
    fields: [threadFolders.folderId],
    references: [folders.id],
  }),
}));
