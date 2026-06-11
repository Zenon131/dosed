import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  Alert,
  LayoutAnimation,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/constants/MedColors';
import { getAllMeds, getTodayDoses, logDose, undoDose } from '@/utils/medsStore';
import { getGreeting, getSnark } from '@/utils/snark';
import { useUser } from '@/contexts/UserContext';
import { Medication, DoseLog } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

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
        { height, borderRadius: height / 2, backgroundColor: COLORS.surfaceSecondary },
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const isTaken = item.doseLog !== null;
  const takenAtText = isTaken ? formatTakenAt(item.doseLog!.taken_at) : '';
  const timeText = formatTime(item.scheduledTime);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';
  const borderColor = isTaken ? 'rgba(0,200,150,0.2)' : COLORS.border;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.surface,
          borderRadius: 18,
          borderCurve: 'continuous',
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor,
          boxShadow: cardShadow,
          opacity: isTaken ? 0.78 : 1,
        }}
      >
        {/* Med icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderCurve: 'continuous',
            backgroundColor: item.med.color + '30',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <SymbolView name="pills.fill" size={20} tintColor={item.med.color} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: COLORS.text,
              letterSpacing: -0.2,
              textDecorationLine: isTaken ? 'line-through' : 'none',
            }}
            numberOfLines={1}
          >
            {item.med.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{item.med.dosage}</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary }}>·</Text>
            <SymbolView name="clock.fill" size={11} tintColor={COLORS.textTertiary} />
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{timeText}</Text>
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
              <SymbolView name="checkmark.circle.fill" size={20} tintColor={COLORS.accent} />
            </View>
            <Pressable
              onPress={() => {
                console.log('[Today iOS] Undo dose for:', item.med.name);
                onUndo(item);
              }}
              hitSlop={8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <SymbolView name="arrow.uturn.backward" size={10} tintColor={COLORS.textTertiary} />
                <Text style={{ fontSize: 11, color: COLORS.textTertiary }}>undo</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <AnimatedPressable
            onPress={() => {
              console.log('[Today iOS] Take button pressed for:', item.med.name, 'at', item.scheduledTime);
              onTake(item);
            }}
            style={{
              backgroundColor: item.med.color,
              borderRadius: 20,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              paddingVertical: 8,
              minWidth: 64,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Take</Text>
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

function AsNeededCard({
  med,
  takenCount,
  onLog,
}: {
  med: Medication;
  takenCount: number;
  onLog: (med: Medication) => void;
}) {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';
  const takenText = takenCount > 0 ? `${takenCount}× today` : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderCurve: 'continuous',
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: cardShadow,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: med.color + '30',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <SymbolView name="pills.fill" size={20} tintColor={med.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, letterSpacing: -0.2 }}
          numberOfLines={1}
        >
          {med.name}
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
          {med.dosage}
          {takenCount > 0 ? (
            <Text style={{ color: COLORS.accent }}>{' · '}{takenText}</Text>
          ) : null}
        </Text>
      </View>
      <AnimatedPressable
        onPress={() => {
          console.log('[Today iOS] Log as-needed dose pressed for:', med.name);
          onLog(med);
        }}
        style={{
          backgroundColor: med.color,
          borderRadius: 20,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Log dose</Text>
      </AnimatedPressable>
    </View>
  );
}

export default function TodayScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
    console.log('[Today iOS] Loading data for date:', today);
    try {
      setError(null);
      const [allMeds, todayDoses] = await Promise.all([
        getAllMeds(),
        getTodayDoses(today),
      ]);
      setMeds(allMeds);
      setDoses(todayDoses);
      console.log('[Today iOS] Loaded', allMeds.length, 'meds,', todayDoses.length, 'doses');
    } catch (err) {
      console.error('[Today iOS] Failed to load data:', err instanceof Error ? err.message : String(err));
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
      console.log('[Today iOS] Screen focused, reloading data');
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    console.log('[Today iOS] Pull to refresh triggered');
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleTake = useCallback(async (item: ScheduledDose) => {
    console.log('[Today iOS] Taking dose:', item.med.name, 'scheduled at:', item.scheduledTime);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const res = await logDose(item.med.id, item.scheduledTime);
      setDoses(prev => [...prev, res]);
      console.log('[Today iOS] Dose logged successfully:', res.id);
    } catch (err) {
      console.error('[Today iOS] Failed to log dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't log that dose. Try again?");
    }
  }, []);

  const handleUndo = useCallback(async (item: ScheduledDose) => {
    if (!item.doseLog) return;
    console.log('[Today iOS] Undoing dose:', item.doseLog.id, 'for med:', item.med.name);
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await undoDose(item.doseLog.id);
      setDoses(prev => prev.filter(d => d.id !== item.doseLog!.id));
      console.log('[Today iOS] Dose undone successfully');
    } catch (err) {
      console.error('[Today iOS] Failed to undo dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't undo that. Try again?");
    }
  }, []);

  const handleLogAsNeeded = useCallback(async (med: Medication) => {
    console.log('[Today iOS] Logging as-needed dose for:', med.name);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await logDose(med.id, null);
      setDoses(prev => [...prev, res]);
      console.log('[Today iOS] As-needed dose logged:', res.id);
    } catch (err) {
      console.error('[Today iOS] Failed to log as-needed dose:', err instanceof Error ? err.message : String(err));
      Alert.alert('Oops', "Couldn't log that dose. Try again?");
    }
  }, []);

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
  const adherenceRatio = totalExpected > 0 ? totalTaken / totalExpected : 0;

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

  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';

  const headerRight = () => (
    <Pressable
      onPress={() => {
        console.log('[Today iOS] Add med button pressed from header');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/med/new');
      }}
      hitSlop={8}
    >
      <SymbolView name="plus.circle.fill" size={28} tintColor={COLORS.primary} />
    </Pressable>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Today', headerRight }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          <SkeletonLine width="60%" height={18} />
          <View style={{ height: 12 }} />
          <SkeletonLine width="100%" height={80} />
          <View style={{ height: 16 }} />
          {[0, 1, 2].map(i => (
            <View key={i} style={{ marginBottom: 12 }}>
              <SkeletonLine width="100%" height={72} />
            </View>
          ))}
        </ScrollView>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Today', headerRight }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={{ marginBottom: 16 }}>
            <SymbolView name="pills.fill" size={48} tintColor={COLORS.textTertiary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
            Couldn't load your meds
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Today iOS] Retry button pressed');
              setLoading(true);
              loadData();
            }}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 28,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
          </AnimatedPressable>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Today', headerRight }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Date subtitle */}
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 }}>
          {dateDisplay}
        </Text>

        {/* Greeting */}
        <View
          style={{
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            marginBottom: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={60}
            style={{ padding: 14, backgroundColor: COLORS.primaryMuted }}
          >
            <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600', lineHeight: 20 }}>
              {greeting}
            </Text>
          </BlurView>
        </View>

        {/* Snark greeting — glassy BlurView */}
        <View
          style={{
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            marginBottom: 20,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={60}
            style={{ padding: 14, backgroundColor: COLORS.primaryMuted }}
          >
            <Text style={{ fontSize: 14, color: COLORS.primary, fontStyle: 'italic', lineHeight: 20 }}>
              {snarkMessage}
            </Text>
          </BlurView>
        </View>

        {/* Adherence summary card */}
        {totalExpected > 0 && (
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 20,
              marginBottom: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: cardShadow,
            }}
          >
            {/* Progress ring */}
            <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 8,
                  borderColor: COLORS.border,
                  position: 'absolute',
                }}
              />
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 8,
                  borderColor: COLORS.primary,
                  position: 'absolute',
                  borderTopColor: adherenceRatio > 0 ? COLORS.primary : 'transparent',
                  borderRightColor: adherenceRatio > 0.25 ? COLORS.primary : 'transparent',
                  borderBottomColor: adherenceRatio > 0.5 ? COLORS.primary : 'transparent',
                  borderLeftColor: adherenceRatio > 0.75 ? COLORS.primary : 'transparent',
                  transform: [{ rotate: '-90deg' }],
                }}
              />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] }}>
                {totalTaken}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>
                of {totalExpected}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>
                {totalTaken}
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
                of {totalExpected} doses taken
              </Text>
              {totalTaken === totalExpected && totalExpected > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <SymbolView name="checkmark.circle.fill" size={14} tintColor={COLORS.accent} />
                  <Text style={{ fontSize: 13, color: COLORS.accent, fontWeight: '600' }}>
                    All done!
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Empty state */}
        {scheduledDoses.length === 0 && asNeededMeds.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                borderCurve: 'continuous',
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <SymbolView name="pills.fill" size={32} tintColor={COLORS.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
              No meds yet
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 22 }}>
              Living dangerously, I see. Add one.
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[Today iOS] Add med button pressed from empty state');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/med/new');
              }}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 24,
                paddingVertical: 12,
                marginTop: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <SymbolView name="plus" size={16} tintColor="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add medication</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            {/* Scheduled doses */}
            {scheduledDoses.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: COLORS.textSecondary,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
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

            {/* As-needed doses */}
            {asNeededMeds.length > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: COLORS.textSecondary,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginTop: scheduledDoses.length > 0 ? 24 : 0,
                    marginBottom: 12,
                  }}
                >
                  As needed
                </Text>
                {asNeededMeds.map(med => {
                  const takenCount = doses.filter(d => d.medication_id === med.id).length;
                  return (
                    <AsNeededCard
                      key={med.id}
                      med={med}
                      takenCount={takenCount}
                      onLog={handleLogAsNeeded}
                    />
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
