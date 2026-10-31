import { pgTable, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const frequencyEnum = pgEnum('frequency', [
  'once_daily',
  'twice_daily',
  'three_times_daily',
  'four_times_daily',
  'as_needed'
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Links to neon_auth.users
  email: text('email').notNull(),
  full_name: text('full_name'),
  avatar_url: text('avatar_url'),
  caregiver_email: text('caregiver_email'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  push_token: text('push_token'),
  last_seen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('devices_user_id_idx').on(table.user_id),
]);

export const medications = pgTable('medications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dosage: text('dosage').notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  times: text('times').notNull(),
  notes: text('notes'),
  color: text('color').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('medications_user_id_idx').on(table.user_id),
]);

export const dose_logs = pgTable('dose_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  device_id: text('device_id').references(() => devices.id),
  medication_id: text('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade' }),
  scheduled_time: text('scheduled_time'),
  taken_at: timestamp('taken_at', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('dose_logs_user_id_idx').on(table.user_id),
  index('dose_logs_composite_idx').on(table.user_id, table.medication_id, table.taken_at),
]);

export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  file_url: text('file_url').notNull(),
  file_type: text('file_type').notNull(), // e.g., 'prescription_bottle'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('assets_user_id_idx').on(table.user_id),
]);
