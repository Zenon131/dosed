export type Frequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'as_needed';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: Frequency;
  times: string[];
  notes: string | null;
  color: string;
  created_at: string;
}

export interface DoseLog {
  id: string;
  medication_id: string;
  scheduled_time: string | null;
  taken_at: string;
  created_at: string;
}

export interface StatsDay {
  date: string;
  taken: number;
  expected: number;
}

export interface StatsResponse {
  days: StatsDay[];
  current_streak: number;
  total_taken_7d: number;
  total_expected_7d: number;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once_daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: '3× daily',
  four_times_daily: '4× daily',
  as_needed: 'As needed',
};

export const FREQUENCY_COUNT: Record<Frequency, number> = {
  once_daily: 1,
  twice_daily: 2,
  three_times_daily: 3,
  four_times_daily: 4,
  as_needed: 0,
};

export const MED_COLORS = [
  '#FF6B6B',
  '#FFD93D',
  '#6BCBFF',
  '#95E1A3',
  '#C589E8',
  '#FFA45B',
];
