import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import { useColors } from '@/constants/MedColors';
import { createMed } from '@/utils/medsStore';
import { Frequency, MED_COLORS } from '@/types/meds';
import { AnimatedPressable } from '@/components/AnimatedPressable';

// BUG 2 FIX: DateTimePicker has no web implementation — import only on Android
// (this .tsx file is only reached on Android and web; iOS uses new.ios.tsx)
let DateTimePicker: React.ComponentType<{
  value: Date;
  mode: 'time';
  display: 'default';
  onChange: (e: unknown, date?: Date) => void;
}> | null = null;
if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const FREQUENCIES: { value: Frequency; label: string; count: number }[] = [
  { value: 'once_daily', label: 'Once daily', count: 1 },
  { value: 'twice_daily', label: '2× daily', count: 2 },
  { value: 'three_times_daily', label: '3× daily', count: 3 },
  { value: 'four_times_daily', label: '4× daily', count: 4 },
  { value: 'as_needed', label: 'As needed', count: 0 },
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function defaultTimesForCount(count: number): string[] {
  const defaults = ['08:00', '12:00', '16:00', '20:00'];
  return defaults.slice(0, count);
}

function timeStringToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function NewMedScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once_daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(MED_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Android-only: controls which time row's native dialog is open
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState(0);

  const handleFrequencyChange = (freq: Frequency) => {
    console.log('[NewMed] Frequency changed to:', freq);
    setFrequency(freq);
    const count = FREQUENCIES.find(f => f.value === freq)?.count ?? 0;
    setTimes(defaultTimesForCount(count));
  };

  // Android: called by the native time dialog
  const handleTimeChange = (_: unknown, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const newTimes = [...times];
      newTimes[editingTimeIndex] = dateToTimeString(date);
      setTimes(newTimes);
      console.log('[NewMed] Time changed for index', editingTimeIndex, 'to', dateToTimeString(date));
    }
  };

  // Web: called when the user types into the HH:MM text input
  const handleWebTimeInput = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
    // Clear per-time error as user types
    if (errors[`time_${index}`]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`time_${index}`];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!dosage.trim()) errs.dosage = 'Dosage is required';
    // BUG 5 FIX: validate web HH:MM inputs
    if (Platform.OS === 'web' && frequency !== 'as_needed') {
      times.forEach((t, i) => {
        if (!TIME_REGEX.test(t)) {
          errs[`time_${i}`] = 'Enter a valid time (HH:MM)';
        }
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    console.log('[NewMed] Save button pressed, name:', name, 'dosage:', dosage, 'frequency:', frequency);
    if (!validate()) {
      console.log('[NewMed] Validation failed:', errors);
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
      console.log('[NewMed] Creating new medication locally:', payload);
      const res = await createMed(payload);
      console.log('[NewMed] Medication created successfully, id:', res.id);
      router.back();
    } catch (err) {
      console.error('[NewMed] Failed to create medication:', err);
      Alert.alert('Error', "Couldn't save this medication. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  };

  return (
    <>
      {/* BUG 3 FIX: on non-iOS, drop the entire inner Stack.Screen options block —
          the parent _layout.tsx already sets title, headerShown, and presentation.
          Only keep headerRight (Save button) since there's no Cancel on Android/web. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <AnimatedPressable
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </AnimatedPressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View>
          <Text style={labelStyle}>Medication name *</Text>
          <TextInput
            style={[inputStyle, errors.name ? { borderColor: COLORS.danger } : {}]}
            placeholder="e.g. Metformin"
            placeholderTextColor={COLORS.textTertiary}
            value={name}
            onChangeText={text => {
              setName(text);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            autoFocus
            returnKeyType="next"
          />
          {errors.name ? (
            <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{errors.name}</Text>
          ) : null}
        </View>

        {/* Dosage */}
        <View>
          <Text style={labelStyle}>Dosage *</Text>
          <TextInput
            style={[inputStyle, errors.dosage ? { borderColor: COLORS.danger } : {}]}
            placeholder="e.g. 500mg"
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

        {/* Frequency */}
        <View>
          <Text style={labelStyle}>Frequency</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FREQUENCIES.map(f => {
              const isSelected = frequency === f.value;
              return (
                <AnimatedPressable
                  key={f.value}
                  onPress={() => handleFrequencyChange(f.value)}
                  style={{
                    backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: isSelected ? COLORS.primary : COLORS.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
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

        {/* Times */}
        {frequency !== 'as_needed' && times.length > 0 && (
          <View>
            <Text style={labelStyle}>Times</Text>
            <View style={{ gap: 8 }}>
              {times.map((time, i) => {
                const timeError = errors[`time_${i}`];
                // BUG 2 FIX: web gets a plain TextInput; Android gets a tappable row
                // that opens the native time dialog
                if (Platform.OS === 'web') {
                  return (
                    <View key={i}>
                      <TextInput
                        style={[
                          inputStyle,
                          { fontVariant: ['tabular-nums'] },
                          timeError ? { borderColor: COLORS.danger } : {},
                        ]}
                        value={time}
                        onChangeText={val => handleWebTimeInput(i, val)}
                        placeholder="HH:MM"
                        placeholderTextColor={COLORS.textTertiary}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        returnKeyType="done"
                      />
                      {timeError ? (
                        <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>{timeError}</Text>
                      ) : null}
                    </View>
                  );
                }
                // Android
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      console.log('[NewMed] Time picker opened for index:', i);
                      setEditingTimeIndex(i);
                      setShowTimePicker(true);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: COLORS.surfaceSecondary,
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      gap: 10,
                    }}
                  >
                    <Clock size={16} color={COLORS.primary} />
                    <Text style={{ fontSize: 16, color: COLORS.text, flex: 1 }}>
                      {formatTime(time)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* BUG 2 FIX: only render DateTimePicker on Android (never on web) */}
            {Platform.OS === 'android' && showTimePicker && DateTimePicker && (
              <DateTimePicker
                value={timeStringToDate(times[editingTimeIndex])}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
          </View>
        )}

        {/* Color picker */}
        <View>
          <Text style={labelStyle}>Color</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {MED_COLORS.map(c => (
              <AnimatedPressable
                key={c}
                onPress={() => {
                  console.log('[NewMed] Color selected:', c);
                  setColor(c);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: color === c ? 3 : 0,
                  borderColor: '#fff',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                }}
              >
                {color === c && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: '#fff',
                    }}
                  />
                )}
              </AnimatedPressable>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View>
          <Text style={labelStyle}>Notes (optional)</Text>
          <TextInput
            style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Any special instructions..."
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
          disabled={saving}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving ? 'Saving...' : 'Save medication'}
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </>
  );
}
