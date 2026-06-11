import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil, Trash2, Pill, Clock, FileText, Calendar } from 'lucide-react-native';
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MedDetailScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [med, setMed] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMed = useCallback(async () => {
    if (!id) return;
    console.log('[MedDetail] Loading medication id:', id);
    try {
      setError(null);
      const result = await getMedById(id);
      setMed(result);
      console.log('[MedDetail] Loaded med:', result?.name);
    } catch (err) {
      console.error('[MedDetail] Failed to load medication:', err instanceof Error ? err.message : String(err));
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
      console.log('[MedDetail] Screen focused, reloading');
      loadMed();
    }, [loadMed])
  );

  const handleDelete = useCallback(() => {
    console.log('[MedDetail] Delete button pressed for med:', med?.name, 'id:', id);
    Alert.alert(
      `Delete ${med?.name ?? 'medication'}?`,
      "This will remove the medication and all its dose history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[MedDetail] Delete cancelled') },
        {
          text: `Delete ${med?.name ?? 'medication'}`,
          style: 'destructive',
          onPress: async () => {
            console.log('[MedDetail] Confirmed delete for med id:', id);
            try {
              await deleteMed(id!);
              console.log('[MedDetail] Medication deleted successfully');
              router.back();
            } catch (err) {
              console.error('[MedDetail] Failed to delete medication:', err instanceof Error ? err.message : String(err));
              Alert.alert('Error', "Couldn't delete this medication. Try again.");
            }
          },
        },
      ]
    );
  }, [id, med, router]);

  const freqLabel = med ? FREQUENCY_LABELS[med.frequency] : '';
  const addedDate = med ? formatDate(med.created_at) : '';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  if (error || !med) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
          Couldn't load medication
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>
          {error}
        </Text>
        <AnimatedPressable
          onPress={() => {
            console.log('[MedDetail] Retry button pressed');
            setLoading(true);
            loadMed();
          }}
          style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: med.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AnimatedPressable
                onPress={() => {
                  console.log('[MedDetail] Edit button pressed for med:', med.name, 'id:', id);
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
                <Pencil size={16} color={COLORS.primary} />
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
                <Trash2 size={16} color={COLORS.danger} />
              </AnimatedPressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Color hero header */}
        <View
          style={{
            backgroundColor: med.color + '20',
            paddingTop: 32,
            paddingBottom: 32,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: med.color + '30',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: med.color + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Pill size={36} color={med.color} />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center', letterSpacing: -0.3 }}>
            {med.name}
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 4 }}>
            {med.dosage}
          </Text>
          <View
            style={{
              backgroundColor: med.color + '25',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginTop: 12,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: med.color }}>
              {freqLabel}
            </Text>
          </View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          {/* Schedule */}
          {med.times.length > 0 && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>Schedule</Text>
              </View>
              {med.times.map((time, i) => {
                const timeFormatted = formatTime(time);
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: COLORS.divider,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: med.color, marginRight: 12 }} />
                    <Text style={{ fontSize: 15, color: COLORS.text, fontWeight: '500' }}>
                      {timeFormatted}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Notes */}
          {med.notes && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileText size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>Notes</Text>
              </View>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 }}>
                {med.notes}
              </Text>
            </View>
          )}

          {/* Added date */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color={COLORS.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>Added</Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginLeft: 4 }}>
                {addedDate}
              </Text>
            </View>
          </View>

          {/* Delete button */}
          <AnimatedPressable
            onPress={handleDelete}
            style={{
              backgroundColor: COLORS.danger + '12',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <Trash2 size={18} color={COLORS.danger} />
            <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 15 }}>
              Delete {med.name}
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </>
  );
}
