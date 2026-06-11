import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  useColorScheme,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/constants/MedColors';
import { getStats7Day } from '@/utils/medsStore';
import { getStreakSnark } from '@/utils/snark';
import { StatsResponse, StatsDay } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

function getTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayInitial(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
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

function AnimatedBar({
  day,
  maxExpected,
  index,
  isToday,
}: {
  day: StatsDay;
  maxExpected: number;
  index: number;
  isToday: boolean;
}) {
  const COLORS = useColors();
  const BAR_HEIGHT = 100;
  const animValue = useRef(new Animated.Value(0)).current;

  const pct = day.expected > 0 ? day.taken / day.expected : 0;
  const expectedH = maxExpected > 0 ? (day.expected / maxExpected) * BAR_HEIGHT : 0;
  const takenH = day.expected > 0 ? pct * expectedH : 0;

  let barColor = COLORS.textTertiary;
  if (day.expected > 0) {
    if (pct >= 0.8) barColor = '#34C759';
    else if (pct >= 0.5) barColor = '#FFCC00';
    else barColor = '#FF3B30';
  }

  const dayInitial = formatDayInitial(day.date);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      useNativeDriver: false,
    }).start();
  }, [animValue, index]);

  const animatedTakenH = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(takenH, day.taken > 0 ? 4 : 0)],
  });

  const animatedExpectedH = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(expectedH, 4)],
  });

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ width: '100%', height: BAR_HEIGHT, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: animatedExpectedH,
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 6,
            borderCurve: 'continuous',
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: animatedTakenH,
            backgroundColor: barColor,
            borderRadius: 6,
            borderCurve: 'continuous',
            opacity: isToday ? 1 : 0.85,
          }}
        />
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: isToday ? '700' : '500',
          color: isToday ? COLORS.primary : COLORS.textSecondary,
        }}
      >
        {dayInitial}
      </Text>
    </View>
  );
}

export default function StatsScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [snarkMessage, setSnarkMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = getTodayDate();

  const loadStats = useCallback(async () => {
    console.log('[Stats iOS] Loading local stats');
    try {
      setError(null);
      const res = await getStats7Day();
      setStats(res);
      const snark = getStreakSnark(res.current_streak);
      setSnarkMessage(snark);
      console.log('[Stats iOS] Loaded stats, streak:', res.current_streak);
    } catch (err) {
      console.error('[Stats iOS] Failed to load stats:', err instanceof Error ? err.message : String(err));
      setError("Couldn't load your stats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Stats iOS] Screen focused, reloading');
      loadStats();
    }, [loadStats])
  );

  const onRefresh = useCallback(() => {
    console.log('[Stats iOS] Pull to refresh triggered');
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';

  const weekPct = stats && stats.total_expected_7d > 0
    ? Math.round((stats.total_taken_7d / stats.total_expected_7d) * 100)
    : 0;

  const weekPctText = `${weekPct}%`;
  const streakLabel = 'day streak';
  const streakCount = stats ? String(stats.current_streak) : '0';
  const maxExpected = stats ? Math.max(...stats.days.map(d => d.expected), 1) : 1;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Stats',
          headerLargeTitle: true,
          headerTransparent: true,
          headerBlurEffect: 'systemMaterial',
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerLargeStyle: { backgroundColor: 'transparent' },
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {loading ? (
          <View style={{ paddingTop: 16, gap: 16 }}>
            <SkeletonLine width="100%" height={120} />
            <SkeletonLine width="100%" height={180} />
            <SkeletonLine width="100%" height={80} />
          </View>
        ) : error ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View style={{ marginBottom: 16 }}>
              <SymbolView name="chart.bar.fill" size={48} tintColor={COLORS.textTertiary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
              Couldn't load stats
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              {error}
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[Stats iOS] Retry button pressed');
                setLoading(true);
                loadStats();
              }}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 28, paddingVertical: 14 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
            </AnimatedPressable>
          </View>
        ) : stats ? (
          <View style={{ paddingTop: 8, gap: 16 }}>
            {/* Streak card */}
            <View
              style={{
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 20,
                borderCurve: 'continuous',
                padding: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 48,
                    fontWeight: '800',
                    color: COLORS.text,
                    letterSpacing: -2,
                    fontVariant: ['tabular-nums'],
                    lineHeight: 52,
                  }}
                >
                  {streakCount}
                </Text>
                <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 2 }}>
                  {streakLabel}
                </Text>
                {snarkMessage ? (
                  <Text
                    style={{
                      fontSize: 13,
                      color: COLORS.primary,
                      fontStyle: 'italic',
                      marginTop: 10,
                      lineHeight: 18,
                      maxWidth: 220,
                    }}
                  >
                    {snarkMessage}
                  </Text>
                ) : null}
              </View>
              <SymbolView name="flame.fill" size={40} tintColor="#FF9500" />
            </View>

            {/* 7-day bar chart */}
            {stats.days.length > 0 && (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  boxShadow: cardShadow,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: -0.3, marginBottom: 20 }}>
                  Last 7 days
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 132 }}>
                  {stats.days.map((day, i) => (
                    <AnimatedBar
                      key={day.date}
                      day={day}
                      maxExpected={maxExpected}
                      index={i}
                      isToday={day.date === today}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#34C759' }} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>≥80%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#FFCC00' }} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>50–79%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#FF3B30' }} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>&lt;50%</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Summary tiles */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, borderWidth: 1, borderColor: COLORS.border, boxShadow: cardShadow }}>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Taken</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                  {stats.total_taken_7d}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, borderWidth: 1, borderColor: COLORS.border, boxShadow: cardShadow }}>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Expected</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                  {stats.total_expected_7d}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, borderCurve: 'continuous', padding: 14, borderWidth: 1, borderColor: COLORS.border, boxShadow: cardShadow }}>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Adherence</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: weekPct >= 80 ? '#34C759' : weekPct >= 50 ? '#FFCC00' : '#FF3B30', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                  {weekPctText}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
