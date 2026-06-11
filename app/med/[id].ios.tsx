import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/constants/MedColors';
import { getMedById, deleteMed } from '@/utils/medsStore';
import { Medication, FREQUENCY_LABELS } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const COLORS = useColors();
  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: COLORS.divider,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: COLORS.textSecondary,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 1,
          minWidth: 80,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: COLORS.text,
          flex: 1,
          textAlign: 'right',
          lineHeight: 22,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function MedDetailScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [med, setMed] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMed = useCallback(async () => {
    if (!id) return;
    console.log('[MedDetail iOS] Loading medication id:', id);
    try {
      setError(null);
      const result = await getMedById(id);
      setMed(result);
      console.log('[MedDetail iOS] Loaded med:', result?.name);
    } catch (err) {
      console.error('[MedDetail iOS] Failed to load medication:', err instanceof Error ? err.message : String(err));
      setError("Couldn't load this medication.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMed();
  }, [loadMed]);

  useFocusEffect(
    useCallback(() => {
      console.log('[MedDetail iOS] Screen focused, reloading');
      loadMed();
    }, [loadMed])
  );

  const handleDelete = useCallback(() => {
    console.log('[MedDetail iOS] Delete button pressed for med:', med?.name, 'id:', id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      `Delete ${med?.name ?? 'medication'}?`,
      "This will remove the medication and all its dose history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[MedDetail iOS] Delete cancelled') },
        {
          text: `Delete ${med?.name ?? 'medication'}`,
          style: 'destructive',
          onPress: async () => {
            console.log('[MedDetail iOS] Confirmed delete for med id:', id);
            try {
              await deleteMed(id!);
              console.log('[MedDetail iOS] Medication deleted successfully');
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              console.error('[MedDetail iOS] Failed to delete medication:', err instanceof Error ? err.message : String(err));
              Alert.alert('Error', "Couldn't delete this medication. Try again.");
            }
          },
        },
      ]
    );
  }, [id, med, router]);

  const freqLabel = med ? FREQUENCY_LABELS[med.frequency] : '';
  const addedDate = med ? formatDate(med.created_at) : '';
  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false, headerTransparent: true, headerBlurEffect: 'systemMaterial' }} />
        <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolView name="pills.fill" size={32} tintColor={COLORS.textTertiary} />
        </View>
      </>
    );
  }

  if (error || !med) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false, headerTransparent: true, headerBlurEffect: 'systemMaterial' }} />
        <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
            Couldn't load medication
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[MedDetail iOS] Retry button pressed');
              setLoading(true);
              loadMed();
            }}
            style={{ backgroundColor: COLORS.primary, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 28, paddingVertical: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
          </AnimatedPressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: med.name,
          headerLargeTitle: false,
          headerTransparent: true,
          headerBlurEffect: 'systemMaterial',
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[MedDetail iOS] Edit button pressed for med:', med.name, 'id:', id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/med/edit/${id}`);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name="pencil" size={16} tintColor={COLORS.primary} />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleDelete}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: COLORS.danger + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name="trash" size={16} tintColor={COLORS.danger} />
              </AnimatedPressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Hero section */}
        <View
          style={{
            height: 160,
            backgroundColor: med.color + '20',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 24,
            borderCurve: 'continuous',
            marginHorizontal: 20,
            marginTop: 12,
            marginBottom: 24,
          }}
        >
          <SymbolView name="pills.fill" size={60} tintColor={med.color} />
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          {/* Info card */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: cardShadow,
              overflow: 'hidden',
            }}
          >
            <InfoRow label="Dosage" value={med.dosage} />
            <InfoRow label="Frequency" value={freqLabel} />
            <InfoRow label="Added" value={addedDate} isLast={!med.notes} />
            {med.notes ? (
              <InfoRow label="Notes" value={med.notes} isLast />
            ) : null}
          </View>

          {/* Times card */}
          {med.times.length > 0 && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: cardShadow,
                overflow: 'hidden',
              }}
            >
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: COLORS.textSecondary,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  Schedule
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {med.times.map((time, i) => {
                    const timeFormatted = formatTime(time);
                    return (
                      <View
                        key={i}
                        style={{
                          backgroundColor: med.color + '20',
                          borderRadius: 12,
                          borderCurve: 'continuous',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: med.color }}>
                          {timeFormatted}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Delete button */}
          <AnimatedPressable
            onPress={handleDelete}
            style={{
              backgroundColor: COLORS.danger + '12',
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <SymbolView name="trash" size={18} tintColor={COLORS.danger} />
            <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 15 }}>
              Delete {med.name}
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </>
  );
}
