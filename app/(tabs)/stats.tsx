import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/constants/MedColors';
import { getStats7Day } from '@/utils/medsStore';
import { getStreakSnark } from '@/utils/snark';
import { StatsResponse, StatsDay } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { TrendingUp, Flame, CheckCircle } from 'lucide-react-native';

function getTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
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

function BarChart({ days }: { days: StatsDay[] }) {
  const COLORS = useColors();
  const today = getTodayDate();
  const maxExpected = Math.max(...days.map(d => d.expected), 1);
  const BAR_HEIGHT = 100;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT + 32 }}>
      {days.map((day) => {
        const expectedHeight = (day.expected / maxExpected) * BAR_HEIGHT;
        const takenHeight = day.expected > 0 ? (day.taken / day.expected) * expectedHeight : 0;
        const pct = day.expected > 0 ? Math.round((day.taken / day.expected) * 100) : 0;
        const isToday = day.date === today;
        const dayLabel = formatDayLabel(day.date);

        return (
          <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: '100%', height: BAR_HEIGHT, justifyContent: 'flex-end', position: 'relative' }}>
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(expectedHeight, 4),
                  backgroundColor: COLORS.surfaceSecondary,
                  borderRadius: 6,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(takenHeight, day.taken > 0 ? 4 : 0),
                  backgroundColor: pct >= 100 ? COLORS.accent : COLORS.primary,
                  borderRadius: 6,
                  opacity: isToday ? 1 : 0.8,
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
              {dayLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [snarkMessage, setSnarkMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    console.log('[Stats] Loading local stats');
    try {
      setError(null);
      const res = await getStats7Day();
      setStats(res);
      const snark = getStreakSnark(res.current_streak);
      setSnarkMessage(snark);
      console.log('[Stats] Loaded stats, streak:', res.current_streak);
    } catch (err) {
      console.error('[Stats] Failed to load stats:', err instanceof Error ? err.message : String(err));
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
      console.log('[Stats] Screen focused, reloading');
      loadStats();
    }, [loadStats])
  );

  const onRefresh = useCallback(() => {
    console.log('[Stats] Pull to refresh triggered');
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  const weekPct = stats && stats.total_expected_7d > 0
    ? Math.round((stats.total_taken_7d / stats.total_expected_7d) * 100)
    : 0;

  const streakDayLabel = stats && stats.current_streak === 1 ? 'day' : 'days';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 120 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 24 }}>
        Stats
      </Text>

      {loading ? (
        <>
          <SkeletonLine width="100%" height={120} />
          <View style={{ height: 16 }} />
          <SkeletonLine width="100%" height={180} />
          <View style={{ height: 16 }} />
          <SkeletonLine width="100%" height={80} />
        </>
      ) : error ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📊</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
            Couldn't load stats
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Stats] Retry button pressed');
              setLoading(true);
              loadStats();
            }}
            style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
          </AnimatedPressable>
        </View>
      ) : stats ? (
        <>
          {/* Streak card */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 24,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Flame size={20} color="#FF6B35" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Current streak
              </Text>
            </View>
            <Text style={{ fontSize: 56, fontWeight: '900', color: COLORS.text, letterSpacing: -2 }}>
              {stats.current_streak}
            </Text>
            <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: -4 }}>
              {streakDayLabel}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.primary, fontStyle: 'italic', marginTop: 12, lineHeight: 20 }}>
              {snarkMessage}
            </Text>
          </View>

          {/* 7-day chart */}
          {stats.days.length > 0 && (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 20,
                padding: 20,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <TrendingUp size={18} color={COLORS.primary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Last 7 days</Text>
              </View>
              <BarChart days={stats.days} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.primary }} />
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Taken</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.surfaceSecondary }} />
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Expected</Text>
                </View>
              </View>
            </View>
          )}

          {/* Weekly summary */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CheckCircle size={18} color={COLORS.accent} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>This week</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.primaryMuted, borderRadius: 14, padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.primary }}>
                  {stats.total_taken_7d}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>taken</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: 14, padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.text }}>
                  {stats.total_expected_7d}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>expected</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: weekPct >= 80 ? COLORS.accent + '20' : COLORS.warning + '20',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '800', color: weekPct >= 80 ? COLORS.accent : COLORS.warning }}>
                  {weekPct}%
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>rate</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
