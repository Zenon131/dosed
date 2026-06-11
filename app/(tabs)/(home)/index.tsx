import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, Clock, Pill, Plus, RotateCcw } from 'lucide-react-native';
import { useColors } from '@/constants/MedColors';
import { getAllMeds, getTodayDoses, logDose, undoDose } from '@/utils/medsStore';
import { getGreeting, getSnark } from '@/utils/snark';
import { useUser } from '@/contexts/UserContext';
import { Medication, DoseLog, FREQUENCY_LABELS } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTakenAt(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface ScheduledDose {
  med: Medication;
  scheduledTime: string;
  doseLog: DoseLog | null;
}

function AdherenceRing({ taken, total, color }: { taken: number; total: number; color: string }) {
  const size = 80;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? taken / total : 0;
  const strokeDashoffset = circumference * (1 - progress);
  const COLORS = useColors();

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: COLORS.border,
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          position: 'absolute',
          transform: [{ rotate: '-90deg' }],
          borderTopColor: progress > 0 ? color : 'transparent',
          borderRightColor: progress > 0.25 ? color : 'transparent',
          borderBottomColor: progress > 0.5 ? color : 'transparent',
          borderLeftColor: progress > 0.75 ? color : 'transparent',
        }}
      />
      <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>{taken}</Text>
      <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>of {total}</Text>
    </View>
  );
}

function SkeletonLine({ width, height = 14 }: { width: number | string; height?: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: COLORS.surfaceSecondary,
        },
        { width: width as number },
        { opacity },
      ]}
    />
  );
}

function DoseCard({
  item,
  index,
  onTake,
  onUndo,
}: {
  item: ScheduledDose;
  index: number;
  onTake: (item: ScheduledDose) => void;
  onUndo: (item: ScheduledDose) => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const isTaken = item.doseLog !== null;
  const takenAtText = isTaken ? formatTakenAt(item.doseLog!.taken_at) : '';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={() => {
          console.log('[Today] Tapped med row:', item.med.name, 'at', item.scheduledTime);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: isTaken ? 'rgba(0,200,150,0.2)' : COLORS.border,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          opacity: isTaken ? 0.75 : 1,
        }}
      >
        {/* Color swatch */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: item.med.color + '30',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Pill size={20} color={item.med.color} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: COLORS.text,
              textDecorationLine: isTaken ? 'line-through' : 'none',
            }}
            numberOfLines={1}
          >
            {item.med.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{item.med.dosage}</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary }}>·</Text>
            <Clock size={12} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{formatTime(item.scheduledTime)}</Text>
          </View>
          {isTaken && (
            <Text style={{ fontSize: 12, color: COLORS.accent, marginTop: 2 }}>
              Taken at {takenAtText}
            </Text>
          )}
        </View>

        {/* Action */}
        {isTaken ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: COLORS.accent + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={16} color={COLORS.accent} />
            </View>
            <TouchableOpacity
              onPress={() => {
                console.log('[Today] Undo dose for:', item.med.name);
                onUndo(item);
              }}
            >
              <Text style={{ fontSize: 11, color: COLORS.textTertiary, textDecorationLine: 'underline' }}>
                undo
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <AnimatedPressable
            onPress={() => {
              console.log('[Today] Take button pressed for:', item.med.name, 'at', item.scheduledTime);
              onTake(item);
            }}
            style={{
              backgroundColor: item.med.color,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
              minWidth: 64,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Take</Text>
          </AnimatedPressable>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { name } = useUser();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = getTodayDate();
  const hour = new Date().getHours();

  const loadData = useCallback(async () => {
    console.log('[Today] Loading data for date:', today);
    try {
      setError(null);
      const [allMeds, todayDoses] = await Promise.all([
        getAllMeds(),
        getTodayDoses(today),
      ]);
      setMeds(allMeds);
      setDoses(todayDoses);
      console.log('[Today] Loaded', allMeds.length, 'meds,', todayDoses.length, 'doses');
    } catch (err) {
      console.error('[Today] Failed to load data:', err instanceof Error ? err.message : String(err));
      setError("Couldn't load your meds.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Today] Screen focused, reloading data');
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    console.log('[Today] Pull to refresh triggered');
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleTake = useCallback(async (item: ScheduledDose) => {
    console.log('[Today] Taking dose:', item.med.name, 'scheduled at:', item.scheduledTime);
    if (Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const res = await logDose(item.med.id, item.scheduledTime);
      setDoses(prev => [...prev, res]);
      console.log('[Today] Dose logged successfully:', res.id);
    } catch (err) {
      console.error('[Today] Failed to log dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't log that dose. Try again?");
    }
  }, []);

  const handleUndo = useCallback(async (item: ScheduledDose) => {
    if (!item.doseLog) return;
    console.log('[Today] Undoing dose:', item.doseLog.id, 'for med:', item.med.name);
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await undoDose(item.doseLog.id);
      setDoses(prev => prev.filter(d => d.id !== item.doseLog!.id));
      console.log('[Today] Dose undone successfully');
    } catch (err) {
      console.error('[Today] Failed to undo dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't undo that. Try again?");
    }
  }, []);

  const handleLogAsNeeded = useCallback(async (med: Medication) => {
    console.log('[Today] Logging as-needed dose for:', med.name);
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const res = await logDose(med.id, null);
      setDoses(prev => [...prev, res]);
      console.log('[Today] As-needed dose logged:', res.id);
    } catch (err) {
      console.error('[Today] Failed to log as-needed dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't log that dose. Try again?");
    }
  }, []);

  // Build scheduled doses
  const scheduledMeds = meds.filter(m => m.frequency !== 'as_needed');
  const asNeededMeds = meds.filter(m => m.frequency === 'as_needed');

  const scheduledDoses: ScheduledDose[] = scheduledMeds.flatMap(med =>
    med.times.map(time => {
      const doseLog = doses.find(
        d => d.medication_id === med.id && d.scheduled_time === time
      ) ?? null;
      return { med, scheduledTime: time, doseLog };
    })
  );

  scheduledDoses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const totalExpected = scheduledDoses.length;
  const totalTaken = scheduledDoses.filter(d => d.doseLog !== null).length;
  const pendingNow = scheduledDoses.filter(d => d.doseLog === null).length;
  const asNeededTaken = doses.filter(d => d.scheduled_time === null).length;

  const greeting = getGreeting(name, hour);
  const snarkMessage = getSnark({
    name,
    takenToday: totalTaken,
    expectedToday: totalExpected,
    pendingNow,
    hour,
  });

  const dateDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <SkeletonLine width={120} height={32} />
        <View style={{ height: 8 }} />
        <SkeletonLine width={200} height={16} />
        <View style={{ height: 32 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonLine width="100%" height={72} />
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>💊</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
          Couldn't load your meds
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>
          {error}
        </Text>
        <AnimatedPressable
          onPress={() => {
            console.log('[Today] Retry button pressed');
            setLoading(true);
            loadData();
          }}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            paddingHorizontal: 28,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 120 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header */}
      <View style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 }}>
          Today
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
          {dateDisplay}
        </Text>
      </View>

      {/* Greeting */}
      <View
        style={{
          backgroundColor: COLORS.primaryMuted,
          borderRadius: 14,
          padding: 14,
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600', lineHeight: 20 }}>
          {greeting}
        </Text>
      </View>

      {/* Snark */}
      <View
        style={{
          backgroundColor: COLORS.primaryMuted,
          borderRadius: 14,
          padding: 14,
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 14, color: COLORS.primary, fontStyle: 'italic', lineHeight: 20 }}>
          {snarkMessage}
        </Text>
      </View>

      {/* Adherence summary */}
      {totalExpected > 0 && (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 20,
            borderWidth: 1,
            borderColor: COLORS.border,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <AdherenceRing taken={totalTaken} total={totalExpected} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text }}>
              {totalTaken}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
              of {totalExpected} doses taken
            </Text>
            {totalTaken === totalExpected && totalExpected > 0 && (
              <Text style={{ fontSize: 13, color: COLORS.accent, marginTop: 4, fontWeight: '600' }}>
                All done! 🎉
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Scheduled doses */}
      {scheduledDoses.length === 0 && asNeededMeds.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Pill size={32} color={COLORS.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
            No meds yet
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 22 }}>
            Living dangerously, I see. Add one.
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Today] Add med button pressed from empty state');
              router.push('/med/new');
            }}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              paddingHorizontal: 24,
              paddingVertical: 12,
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add medication</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <>
          {scheduledDoses.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
                Scheduled
              </Text>
              {scheduledDoses.map((item, index) => (
                <DoseCard
                  key={`${item.med.id}-${item.scheduledTime}`}
                  item={item}
                  index={index}
                  onTake={handleTake}
                  onUndo={handleUndo}
                />
              ))}
            </>
          )}

          {asNeededMeds.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 }}>
                As needed
              </Text>
              {asNeededMeds.map((med) => {
                const takenCount = doses.filter(d => d.medication_id === med.id).length;
                const takenText = takenCount > 0 ? ` · ${takenCount}× today` : '';
                return (
                  <Animated.View key={med.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: COLORS.surface,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
                      }}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: med.color + '30',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Pill size={20} color={med.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }} numberOfLines={1}>
                          {med.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                          {med.dosage}
                          {takenText}
                        </Text>
                      </View>
                      <AnimatedPressable
                        onPress={() => {
                          console.log('[Today] Log as-needed dose pressed for:', med.name);
                          handleLogAsNeeded(med);
                        }}
                        style={{
                          backgroundColor: med.color,
                          borderRadius: 20,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Log dose</Text>
                      </AnimatedPressable>
                    </View>
                  </Animated.View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
