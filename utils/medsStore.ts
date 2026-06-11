import * as Crypto from 'expo-crypto';
import { Medication, DoseLog, StatsResponse, FREQUENCY_COUNT } from '@/types/meds';
import { loadMeds, saveMeds, loadDoses, saveDoses, loadUserName } from './storage';
import { logError } from './errorLogger';
import { scheduleMedNotifications, cancelMedNotifications } from './notifications';

function generateId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function getTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getAllMeds(): Promise<Medication[]> {
  console.log('[MedsStore] getAllMeds');
  return loadMeds();
}

export async function getMedById(id: string): Promise<Medication | null> {
  console.log('[MedsStore] getMedById:', id);
  const meds = await loadMeds();
  return meds.find(m => m.id === id) ?? null;
}

export async function createMed(
  input: Omit<Medication, 'id' | 'created_at'>
): Promise<Medication> {
  console.log('[MedsStore] createMed:', input.name);
  const meds = await loadMeds();
  const med: Medication = {
    ...input,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  meds.push(med);
  await saveMeds(meds);
  console.log('[MedsStore] createMed success, id:', med.id);
  try {
    const userName = await loadUserName();
    await scheduleMedNotifications(med, userName);
  } catch (err) {
    logError(err, { context: 'medsStore.createMed.notifications' });
  }
  return med;
}

export async function updateMed(
  id: string,
  input: Partial<Omit<Medication, 'id' | 'created_at'>>
): Promise<Medication> {
  console.log('[MedsStore] updateMed:', id);
  const meds = await loadMeds();
  const idx = meds.findIndex(m => m.id === id);
  if (idx === -1) {
    const err = new Error(`Medication not found: ${id}`);
    logError(err, { context: 'medsStore.updateMed' });
    throw err;
  }
  const updated: Medication = { ...meds[idx], ...input };
  meds[idx] = updated;
  await saveMeds(meds);
  console.log('[MedsStore] updateMed success:', updated.name);
  try {
    const userName = await loadUserName();
    await scheduleMedNotifications(updated, userName);
  } catch (err) {
    logError(err, { context: 'medsStore.updateMed.notifications' });
  }
  return updated;
}

export async function deleteMed(id: string): Promise<void> {
  console.log('[MedsStore] deleteMed:', id);
  const [meds, doses] = await Promise.all([loadMeds(), loadDoses()]);
  const filteredMeds = meds.filter(m => m.id !== id);
  const filteredDoses = doses.filter(d => d.medication_id !== id);
  await Promise.all([saveMeds(filteredMeds), saveDoses(filteredDoses)]);
  console.log('[MedsStore] deleteMed success, also removed doses for med');
  try {
    await cancelMedNotifications(id);
  } catch (err) {
    logError(err, { context: 'medsStore.deleteMed.notifications' });
  }
}

export async function logDose(
  medication_id: string,
  scheduled_time: string | null
): Promise<DoseLog> {
  console.log('[MedsStore] logDose for med:', medication_id, 'at:', scheduled_time);
  const doses = await loadDoses();
  const now = new Date().toISOString();
  const dose: DoseLog = {
    id: generateId(),
    medication_id,
    scheduled_time,
    taken_at: now,
    created_at: now,
  };
  doses.push(dose);
  await saveDoses(doses);
  console.log('[MedsStore] logDose success, id:', dose.id);
  return dose;
}

export async function undoDose(doseId: string): Promise<void> {
  console.log('[MedsStore] undoDose:', doseId);
  const doses = await loadDoses();
  const filtered = doses.filter(d => d.id !== doseId);
  await saveDoses(filtered);
  console.log('[MedsStore] undoDose success');
}

export async function getTodayDoses(dateISO: string): Promise<DoseLog[]> {
  console.log('[MedsStore] getTodayDoses for date:', dateISO);
  const doses = await loadDoses();
  return doses.filter(d => d.taken_at.startsWith(dateISO));
}

export async function getStats7Day(): Promise<StatsResponse> {
  console.log('[MedsStore] getStats7Day');
  const [meds, allDoses] = await Promise.all([loadMeds(), loadDoses()]);

  const days: { date: string; taken: number; expected: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${mo}-${day}`;

    // Expected: sum of scheduled times for meds created on/before this day
    let expected = 0;
    for (const med of meds) {
      if (med.frequency === 'as_needed') continue;
      const createdDate = med.created_at.slice(0, 10);
      if (createdDate <= dateStr) {
        expected += FREQUENCY_COUNT[med.frequency];
      }
    }

    // Taken: doses for this day where scheduled_time is NOT null
    const taken = allDoses.filter(
      d => d.taken_at.startsWith(dateStr) && d.scheduled_time !== null
    ).length;

    days.push({ date: dateStr, taken, expected });
  }

  // Streak: consecutive days from today backward where rate >= 0.8 AND expected > 0
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (day.expected === 0) break;
    const rate = day.taken / day.expected;
    if (rate >= 0.8) {
      streak++;
    } else {
      break;
    }
  }

  const weekly_taken = days.reduce((acc, d) => acc + d.taken, 0);
  const weekly_expected = days.reduce((acc, d) => acc + d.expected, 0);
  const weekly_rate = weekly_expected > 0 ? weekly_taken / weekly_expected : 0;

  console.log('[MedsStore] getStats7Day result: streak', streak, 'weekly_rate', weekly_rate);

  return {
    days,
    current_streak: streak,
    total_taken_7d: weekly_taken,
    total_expected_7d: weekly_expected,
  };
}
