import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication, DoseLog } from '@/types/meds';
import { logError } from './errorLogger';

export const KEYS = {
  MEDS: '@sassy_meds/medications',
  DOSES: '@sassy_meds/doses',
  USER_NAME: '@sassy_meds/user_name',
  ONBOARDED: '@sassy_meds/onboarded',
  DEVICE_ID: '@sassy_meds/device_id',
} as const;

export async function getDeviceId(): Promise<string> {
  try {
    const id = await AsyncStorage.getItem(KEYS.DEVICE_ID);
    if (id) return id;
    
    const newId = Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
    await AsyncStorage.setItem(KEYS.DEVICE_ID, newId);
    return newId;
  } catch (err) {
    logError(err, { context: 'storage.getDeviceId' });
    return 'unknown-device';
  }
}

export async function loadMeds(): Promise<Medication[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MEDS);
    if (!raw) return [];
    return JSON.parse(raw) as Medication[];
  } catch (err) {
    logError(err, { context: 'storage.loadMeds' });
    return [];
  }
}

export async function saveMeds(meds: Medication[]): Promise<void> {
  try {
    console.log('[Storage] Saving', meds.length, 'medications');
    await AsyncStorage.setItem(KEYS.MEDS, JSON.stringify(meds));
  } catch (err) {
    logError(err, { context: 'storage.saveMeds' });
    throw err;
  }
}

export async function loadDoses(): Promise<DoseLog[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DOSES);
    if (!raw) return [];
    return JSON.parse(raw) as DoseLog[];
  } catch (err) {
    logError(err, { context: 'storage.loadDoses' });
    return [];
  }
}

export async function saveDoses(doses: DoseLog[]): Promise<void> {
  try {
    console.log('[Storage] Saving', doses.length, 'doses');
    await AsyncStorage.setItem(KEYS.DOSES, JSON.stringify(doses));
  } catch (err) {
    logError(err, { context: 'storage.saveDoses' });
    throw err;
  }
}

export async function loadUserName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.USER_NAME);
  } catch (err) {
    logError(err, { context: 'storage.loadUserName' });
    return null;
  }
}

export async function saveUserName(name: string): Promise<void> {
  try {
    console.log('[Storage] Saving user name:', name);
    await AsyncStorage.setItem(KEYS.USER_NAME, name);
  } catch (err) {
    logError(err, { context: 'storage.saveUserName' });
    throw err;
  }
}

export async function loadOnboarded(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDED);
    return val === 'true';
  } catch (err) {
    logError(err, { context: 'storage.loadOnboarded' });
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    console.log('[Storage] Setting onboarded flag');
    await AsyncStorage.setItem(KEYS.ONBOARDED, 'true');
  } catch (err) {
    logError(err, { context: 'storage.setOnboarded' });
    throw err;
  }
}

export async function resetAll(): Promise<void> {
  try {
    console.log('[Storage] Resetting all data');
    await AsyncStorage.multiRemove([KEYS.MEDS, KEYS.DOSES, KEYS.USER_NAME, KEYS.ONBOARDED, KEYS.DEVICE_ID]);
  } catch (err) {
    logError(err, { context: 'storage.resetAll' });
    throw err;
  }
}
