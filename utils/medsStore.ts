import * as Crypto from 'expo-crypto';
import { Medication, DoseLog, StatsResponse, FREQUENCY_COUNT } from '@/types/meds';
import { loadMeds, saveMeds, loadDoses, saveDoses, loadUserName, getDeviceId, loadDeletedMedIds, saveDeletedMedIds } from './storage';
import { logError } from './errorLogger';
import { scheduleMedNotifications, cancelMedNotifications } from './notifications';
import { API_BASE_URL } from '@/constants/api';

function generateId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

async function getCloudHeaders(): Promise<Record<string, string>> {
  const userId = await getDeviceId();
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    'x-device-id': userId,
  };
}

export async function getAllMeds(): Promise<Medication[]> {
  console.log('[MedsStore] getAllMeds');
  const [localMeds, deletedIds] = await Promise.all([loadMeds(), loadDeletedMedIds()]);
  const deletedSet = new Set(deletedIds);

  // Sweep: cancel any orphaned local notifications for tombstoned meds
  // (catches notifications orphaned by buggy-era deletes that errored
  // before cancelMedNotifications could run)
  for (const deletedId of deletedIds) {
    cancelMedNotifications(deletedId).catch(() => {});
  }

  // Filter out any tombstoned meds from local before anything else
  const liveLocalMeds = localMeds.filter(m => !deletedSet.has(m.id));
  if (liveLocalMeds.length !== localMeds.length) {
    console.log('[MedsStore] getAllMeds: filtering out', localMeds.length - liveLocalMeds.length, 'tombstoned local meds');
  }

  try {
    const headers = await getCloudHeaders();
    const res = await fetch(`${API_BASE_URL}/api/medications`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.medications)) {
        const cloudMeds: Medication[] = data.medications.filter(
          (m: Medication) => !(m.id === '1' && m.name === 'Test Med')
        );

        // NEVER resurrect tombstoned meds from the cloud — and actively
        // reconcile: DELETE the stale rows server-side so the AI
        // dispatcher stops sending notifications for them
        const tombstonedCloudMeds = cloudMeds.filter(m => deletedSet.has(m.id));
        const liveCloudMeds = cloudMeds.filter(m => !deletedSet.has(m.id));
        if (tombstonedCloudMeds.length > 0) {
          console.log('[MedsStore] getAllMeds: reconciling', tombstonedCloudMeds.length, 'tombstoned cloud meds (deleting from server)');
          for (const med of tombstonedCloudMeds) {
            fetch(`${API_BASE_URL}/api/medications/${med.id}`, {
              method: 'DELETE',
              headers,
            }).catch(() => {});
          }
        }

        const cloudIds = new Set(liveCloudMeds.map(m => m.id));
        const unsyncedLocal = liveLocalMeds.filter(m => !cloudIds.has(m.id));

        for (const med of unsyncedLocal) {
          fetch(`${API_BASE_URL}/api/medications`, {
            method: 'POST',
            headers,
            body: JSON.stringify(med),
          }).catch(() => {});
        }

        const merged = [...liveCloudMeds, ...unsyncedLocal];
        await saveMeds(merged);
        return merged;
      }
    }
  } catch (err) {
    console.log('[MedsStore] Cloud fetch fallback to local cache:', err instanceof Error ? err.message : String(err));
  }
  return liveLocalMeds;
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

  // Sync to Cloud (Neon Postgres via Railway)
  try {
    const headers = await getCloudHeaders();
    await fetch(`${API_BASE_URL}/api/medications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(med),
    });
  } catch (err) {
    console.log('[MedsStore] Cloud sync createMed deferred:', err instanceof Error ? err.message : String(err));
  }

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

  try {
    const headers = await getCloudHeaders();
    await fetch(`${API_BASE_URL}/api/medications/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    });
  } catch (err) {
    console.log('[MedsStore] Cloud sync updateMed deferred:', err instanceof Error ? err.message : String(err));
  }

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

  // 1. TOMBSTONE FIRST — record the deletion permanently before anything else.
  //    This guarantees getAllMeds can never resurrect this med, even if the
  //    cloud delete fails or a concurrent sync is in flight.
  try {
    const deletedIds = await loadDeletedMedIds();
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      await saveDeletedMedIds(deletedIds);
      console.log('[MedsStore] Tombstone recorded for med:', id);
    }
  } catch (err) {
    console.error('[MedsStore] CRITICAL: failed to record tombstone:', err instanceof Error ? err.message : String(err));
  }

  // 2. Attempt cloud delete (best-effort; failure is logged, not fatal)
  try {
    const headers = await getCloudHeaders();
    const res = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      console.warn('[MedsStore] Cloud delete returned non-OK status:', res.status);
    }
  } catch (err) {
    console.warn('[MedsStore] Cloud delete network error (tombstone will prevent resurrection):', err instanceof Error ? err.message : String(err));
  }

  // 3. ALWAYS remove from local storage
  try {
    const [meds, doses] = await Promise.all([loadMeds(), loadDoses()]);
    const filteredMeds = meds.filter(m => m.id !== id);
    const filteredDoses = doses.filter(d => d.medication_id !== id);
    await Promise.all([saveMeds(filteredMeds), saveDoses(filteredDoses)]);
    console.log('[MedsStore] Local delete success for med:', id);
  } catch (localErr) {
    console.error('[MedsStore] Local delete failed (tombstone still active):', localErr instanceof Error ? localErr.message : String(localErr));
  }

  // 4. Cancel notifications
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

  try {
    const headers = await getCloudHeaders();
    await fetch(`${API_BASE_URL}/api/doses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dose),
    });
  } catch (err) {
    console.log('[MedsStore] Cloud sync logDose deferred:', err instanceof Error ? err.message : String(err));
  }

  console.log('[MedsStore] logDose success, id:', dose.id);
  return dose;
}

export async function undoDose(doseId: string): Promise<void> {
  console.log('[MedsStore] undoDose:', doseId);
  const doses = await loadDoses();
  const filtered = doses.filter(d => d.id !== doseId);
  await saveDoses(filtered);

  try {
    const headers = await getCloudHeaders();
    await fetch(`${API_BASE_URL}/api/doses/${doseId}`, {
      method: 'DELETE',
      headers,
    });
  } catch (err) {
    console.log('[MedsStore] Cloud sync undoDose deferred:', err instanceof Error ? err.message : String(err));
  }

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

    let expected = 0;
    for (const med of meds) {
      if (med.frequency === 'as_needed') continue;
      const createdDate = med.created_at.slice(0, 10);
      if (createdDate <= dateStr) {
        expected += FREQUENCY_COUNT[med.frequency];
      }
    }

    const taken = allDoses.filter(
      d => d.taken_at.startsWith(dateStr) && d.scheduled_time !== null
    ).length;

    days.push({ date: dateStr, taken, expected });
  }

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