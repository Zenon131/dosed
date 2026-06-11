import React from 'react';
import { View } from 'react-native';
import { Slot, usePathname } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';

const TABS = [
  {
    name: '(home)',
    route: '/(tabs)/(home)' as const,
    icon: 'home' as const,
    label: 'Today',
  },
  {
    name: 'meds',
    route: '/(tabs)/meds' as const,
    icon: 'medication' as const,
    label: 'Meds',
  },
  {
    name: 'stats',
    route: '/(tabs)/stats' as const,
    icon: 'bar-chart' as const,
    label: 'Stats',
  },
  {
    name: 'settings',
    route: '/(tabs)/settings' as const,
    icon: 'settings' as const,
    label: 'Settings',
  },
];

export default function TabLayout() {
  const pathname = usePathname();
  const isMedDetail = pathname.startsWith('/med/');

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {!isMedDetail && (
        <FloatingTabBar
          tabs={TABS}
          containerWidth={360}
          borderRadius={35}
          bottomMargin={20}
        />
      )}
    </View>
  );
}
