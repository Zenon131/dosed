import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  loadUserName,
  saveUserName,
  loadOnboarded,
  setOnboarded,
  resetAll,
} from '@/utils/storage';
import { logError } from '@/utils/errorLogger';
import { cancelAllMedNotifications, rescheduleAll } from '@/utils/notifications';
import { getAllMeds } from '@/utils/medsStore';

type UserContextValue = {
  name: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setName: (name: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  reset: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({
  name: null,
  isLoading: true,
  isOnboarded: false,
  setName: async () => {},
  completeOnboarding: async () => {},
  reset: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [name, setNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboardedState] = useState(false);

  useEffect(() => {
    async function load() {
      console.log('[UserContext] Loading user data from storage');
      try {
        const [storedName, storedOnboarded] = await Promise.all([
          loadUserName(),
          loadOnboarded(),
        ]);
        setNameState(storedName);
        setIsOnboardedState(storedOnboarded);
        console.log('[UserContext] Loaded name:', storedName, 'onboarded:', storedOnboarded);
      } catch (err) {
        logError(err, { context: 'UserContext.load' });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const setName = useCallback(async (newName: string) => {
    console.log('[UserContext] setName:', newName);
    await saveUserName(newName);
    setNameState(newName);
    try {
      const meds = await getAllMeds();
      await rescheduleAll(meds, newName);
      console.log('[UserContext] Rescheduled notifications for new name:', newName);
    } catch (err) {
      logError(err, { context: 'UserContext.setName.reschedule' });
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    console.log('[UserContext] completeOnboarding');
    await setOnboarded();
    setIsOnboardedState(true);
  }, []);

  const reset = useCallback(async () => {
    console.log('[UserContext] reset all data');
    try {
      await cancelAllMedNotifications();
      console.log('[UserContext] Cancelled all notifications before reset');
    } catch (err) {
      logError(err, { context: 'UserContext.reset.cancelNotifications' });
    }
    await resetAll();
    setNameState(null);
    setIsOnboardedState(false);
  }, []);

  return (
    <UserContext.Provider value={{ name, isLoading, isOnboarded, setName, completeOnboarding, reset }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
