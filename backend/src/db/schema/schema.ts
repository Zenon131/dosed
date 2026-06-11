import { pgTable, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const frequencyEnum = pgEnum('frequency', [
  'once_daily',
  'twice_daily',
  'three_times_daily',
  'four_times_daily',
  'as_needed'
]);

export const medications = pgTable('medications', {
  id: text('id').primaryKey(),
  device_id: text('device_id').notNull(),
  name: text('name').notNull(),
  dosage: text('dosage').notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  times: text('times').notNull(),
  notes: text('notes'),
  color: text('color').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('medications_device_id_idx').on(table.device_id),
]);

export const dose_logs = pgTable('dose_logs', {
  id: text('id').primaryKey(),
  device_id: text('device_id').notNull(),
  medication_id: text('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade' }),
  scheduled_time: text('scheduled_time'),
  taken_at: timestamp('taken_at', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('dose_logs_device_id_idx').on(table.device_id),
  index('dose_logs_composite_idx').on(table.device_id, table.medication_id, table.taken_at),
]);
