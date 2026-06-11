import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/constants/MedColors';

export default function TabLayout() {
  const COLORS = useColors();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)" label="Today">
        <SymbolView name="house.fill" size={24} tintColor={COLORS.primary} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="meds" label="Meds">
        <SymbolView name="pills.fill" size={24} tintColor={COLORS.primary} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats" label="Stats">
        <SymbolView name="chart.bar.fill" size={24} tintColor={COLORS.primary} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" label="Settings">
        <SymbolView name="gearshape.fill" size={24} tintColor={COLORS.primary} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
