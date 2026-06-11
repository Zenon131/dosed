import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useColors } from '@/constants/MedColors';
import { createMed } from '@/utils/medsStore';
import { Frequency, MED_COLORS } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

const FREQ_OPTIONS: { value: Frequency; label: string; count: number }[] = [
  { value: 'once_daily', label: '1×', count: 1 },
  { value: 'twice_daily', label: '2×', count: 2 },
  { value: 'three_times_daily', label: '3×', count: 3 },
  { value: 'four_times_daily', label: '4×', count: 4 },
  { value: 'as_needed', label: 'PRN', count: 0 },
];

function defaultTimesForCount(count: number): string[] {
  return ['08:00', '12:00', '16:00', '20:00'].slice(0, count);
}

function timeStringToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function NewMedScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once_daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(MED_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isValid = name.trim().length > 0 && dosage.trim().length > 0;
  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';

  const handleFrequencyChange = (freq: Frequency) => {
    console.log('[NewMed iOS] Frequency changed to:', freq);
    Haptics.selectionAsync();
    setFrequency(freq);
    const count = FREQ_OPTIONS.find(f => f.value === freq)?.count ?? 0;
    setTimes(defaultTimesForCount(count));
  };

  const handleTimeChange = (index: number, date?: Date) => {
    if (date) {
      const newTimes = [...times];
      newTimes[index] = dateToTimeString(date);
      setTimes(newTimes);
      console.log('[NewMed iOS] Time changed for index', index, 'to', dateToTimeString(date));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!dosage.trim()) errs.dosage = 'Dosage is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    console.log('[NewMed iOS] Save button pressed, name:', name, 'dosage:', dosage, 'frequency:', frequency);
    if (!validate()) {
      console.log('[NewMed iOS] Validation failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        times: frequency === 'as_needed' ? [] : times,
        notes: notes.trim() || null,
        color,
      };
      console.log('[NewMed iOS] Creating new medication locally:', payload);
      const res = await createMed(payload);
      console.log('[NewMed iOS] Medication created successfully, id:', res.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      console.error('[NewMed iOS] Failed to create medication:', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', "Couldn't save this medication. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const dividerColor = COLORS.divider;

  return (
    <>
      {/* BUG 3 FIX: only override headerLeft/headerRight — drop title, headerLargeTitle,
          headerTransparent, headerBlurEffect, headerShadowVisible (parent sets those) */}
      <Stack.Screen
        options={{
          headerLeft: () => (
            <AnimatedPressable
              onPress={() => {
                console.log('[NewMed iOS] Cancel button pressed');
                router.back();
              }}
            >
              <Text style={{ fontSize: 17, color: COLORS.primary }}>Cancel</Text>
            </AnimatedPressable>
          ),
          headerRight: () => (
            <AnimatedPressable
              onPress={handleSave}
              disabled={!isValid || saving}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: isValid && !saving ? COLORS.primary : COLORS.textTertiary,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </AnimatedPressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 24, paddingTop: 8 }}>
            {/* Name + Dosage group */}
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
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={styles.fieldLabel}>Medication name</Text>
                <TextInput
                  style={[styles.input, { color: COLORS.text }]}
                  placeholder="Lipitor"
                  placeholderTextColor={COLORS.textTertiary}
                  value={name}
                  onChangeText={text => {
                    setName(text);
                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="next"
                />
                {errors.name ? (
                  <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.name}</Text>
                ) : null}
              </View>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: dividerColor }} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={styles.fieldLabel}>Dosage</Text>
                <TextInput
                  style={[styles.input, { color: COLORS.text }]}
                  placeholder="20mg"
                  placeholderTextColor={COLORS.textTertiary}
                  value={dosage}
                  onChangeText={text => {
                    setDosage(text);
                    if (errors.dosage) setErrors(prev => ({ ...prev, dosage: '' }));
                  }}
                  returnKeyType="next"
                />
                {errors.dosage ? (
                  <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.dosage}</Text>
                ) : null}
              </View>
            </View>

            {/* Frequency */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: cardShadow,
                padding: 16,
              }}
            >
              <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>Frequency</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FREQ_OPTIONS.map(f => {
                  const isSelected = frequency === f.value;
                  return (
                    <AnimatedPressable
                      key={f.value}
                      onPress={() => handleFrequencyChange(f.value)}
                      style={{
                        flex: 1,
                        backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary,
                        borderRadius: 10,
                        borderCurve: 'continuous',
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : COLORS.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isSelected ? '#fff' : COLORS.textSecondary,
                        }}
                      >
                        {f.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Times — compact iOS pickers
                BUG 1 FIX: removed overflow:'hidden' from this card so the compact
                picker popover wheel is not clipped by the parent container */}
            {frequency !== 'as_needed' && times.length > 0 && (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  boxShadow: cardShadow,
                  // overflow: 'hidden' intentionally removed — compact picker popover
                  // is clipped by overflow:hidden and cannot render its wheel overlay
                }}
              >
                {times.map((time, i) => (
                  <View key={i}>
                    {i > 0 && (
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: dividerColor }} />
                    )}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <SymbolView name="clock.fill" size={16} tintColor={COLORS.primary} />
                        <Text style={{ fontSize: 15, color: COLORS.textSecondary }}>
                          Dose {i + 1}
                        </Text>
                      </View>
                      <DateTimePicker
                        value={timeStringToDate(time)}
                        mode="time"
                        display="compact"
                        onChange={(_e, date) => handleTimeChange(i, date)}
                        themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Color picker */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: cardShadow,
                padding: 16,
              }}
            >
              <Text style={[styles.fieldLabel, { marginBottom: 14 }]}>Color</Text>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
                {MED_COLORS.map(c => {
                  const isSelected = color === c;
                  return (
                    <AnimatedPressable
                      key={c}
                      onPress={() => {
                        console.log('[NewMed iOS] Color selected:', c);
                        Haptics.selectionAsync();
                        setColor(c);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: c,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: isSelected ? 3 : 0,
                        borderColor: '#fff',
                        boxShadow: isSelected ? `0 0 0 2px ${c}` : undefined,
                      }}
                    >
                      {isSelected && (
                        <SymbolView name="checkmark" size={14} tintColor="#fff" />
                      )}
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: COLORS.border,
                boxShadow: cardShadow,
                padding: 16,
              }}
            >
              <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Notes</Text>
              <TextInput
                style={{
                  fontSize: 15,
                  color: COLORS.text,
                  minHeight: 72,
                  textAlignVertical: 'top',
                }}
                placeholder="Optional notes…"
                placeholderTextColor={COLORS.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>

            {/* Save button */}
            <AnimatedPressable
              onPress={handleSave}
              disabled={!isValid || saving}
              style={{
                backgroundColor: isValid ? COLORS.primary : COLORS.surfaceSecondary,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isValid ? '#fff' : COLORS.textTertiary,
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                {saving ? 'Saving…' : 'Save medication'}
              </Text>
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9B8FBB',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    paddingVertical: 4,
  },
});
