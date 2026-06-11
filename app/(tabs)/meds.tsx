import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Pill } from 'lucide-react-native';
import { useColors } from '@/constants/MedColors';
import { getAllMeds } from '@/utils/medsStore';
import { Medication, FREQUENCY_LABELS } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

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

function MedRow({ med, onPress }: { med: Medication; onPress: () => void }) {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const freqLabel = FREQUENCY_LABELS[med.frequency];
  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)';

  return (
    <AnimatedPressable
      onPress={() => {
        console.log('[Meds] Med row pressed:', med.name, 'id:', med.id);
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
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
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View
          style={{
            backgroundColor: med.color + '20',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: med.color }}>
            {freqLabel}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function MedsScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeds = useCallback(async () => {
    console.log('[Meds] Loading medications');
    try {
      setError(null);
      const data = await getAllMeds();
      setMeds(data);
      console.log('[Meds] Loaded', data.length, 'medications');
    } catch (err) {
      console.error('[Meds] Failed to load medications:', err instanceof Error ? err.message : String(err));
      setError("Couldn't load your medications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeds();
  }, [loadMeds]);

  useFocusEffect(
    useCallback(() => {
      console.log('[Meds] Screen focused, reloading');
      loadMeds();
    }, [loadMeds])
  );

  const onRefresh = useCallback(() => {
    console.log('[Meds] Pull to refresh triggered');
    setRefreshing(true);
    loadMeds();
  }, [loadMeds]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 120,
        }}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 }}>
            Medications
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log('[Meds] Add med FAB pressed');
              router.push('/med/new');
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={22} color="#fff" />
          </AnimatedPressable>
        </View>

        {loading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map(i => (
              <SkeletonLine key={i} width="100%" height={72} />
            ))}
          </View>
        ) : error ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
              Couldn't load meds
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 }}>
              {error}
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[Meds] Retry button pressed');
                setLoading(true);
                loadMeds();
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
        ) : meds.length === 0 ? (
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
              No medications yet
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 22 }}>
              Add your first medication to get started.
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log('[Meds] Add first med button pressed');
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
          meds.map(med => (
            <MedRow
              key={med.id}
              med={med}
              onPress={() => router.push(`/med/${med.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
