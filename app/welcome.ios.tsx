import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { useColors } from '@/constants/MedColors';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

export default function WelcomeScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setName, completeOnboarding } = useUser();

  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cardShadow = isDark
    ? undefined
    : '0 4px 24px rgba(124,77,255,0.12), 0 1px 4px rgba(0,0,0,0.06)';

  const handleSubmit = async () => {
    const trimmed = nameInput.trim();
    console.log('[Welcome iOS] Submit pressed, name:', trimmed);
    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      await setName(trimmed);
      await completeOnboarding();
      console.log('[Welcome iOS] Onboarding complete, navigating to tabs');
      router.replace('/(tabs)/(home)');
    } catch (err) {
      console.error('[Welcome iOS] Failed to save name:', err);
      setError('Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              borderCurve: 'continuous',
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <SymbolView name="pills.fill" size={48} tintColor={COLORS.primary} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 36,
              fontWeight: '900',
              color: COLORS.text,
              letterSpacing: -1,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Dosed
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: 18,
              color: COLORS.textSecondary,
              marginBottom: 40,
              textAlign: 'center',
              lineHeight: 26,
            }}
          >
            What should I call you?
          </Text>

          {/* Input card with blur */}
          <View
            style={{
              width: '100%',
              borderRadius: 20,
              borderCurve: 'continuous',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: cardShadow,
            }}
          >
            <BlurView
              tint={isDark ? 'dark' : 'light'}
              intensity={60}
              style={{ padding: 20, gap: 16, backgroundColor: COLORS.surface }}
            >
              <TextInput
                style={{
                  backgroundColor: COLORS.surfaceSecondary,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 16,
                  fontSize: 18,
                  color: COLORS.text,
                  borderWidth: 1,
                  borderColor: error ? COLORS.danger : COLORS.border,
                }}
                placeholder="Your name"
                placeholderTextColor={COLORS.textTertiary}
                value={nameInput}
                onChangeText={text => {
                  setNameInput(text);
                  if (error) setError('');
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                autoCapitalize="words"
              />
              {error ? (
                <Text style={{ fontSize: 13, color: COLORS.danger, marginTop: -8 }}>
                  {error}
                </Text>
              ) : null}

              <AnimatedPressable
                onPress={() => {
                  console.log("[Welcome iOS] Let's go button pressed");
                  handleSubmit();
                }}
                disabled={saving}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
                  {saving ? 'One sec...' : "Let's go"}
                </Text>
              </AnimatedPressable>
            </BlurView>
          </View>

          {/* Footer note */}
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textTertiary,
              marginTop: 24,
              textAlign: 'center',
              lineHeight: 18,
            }}
          >
            Your name is stored locally.{'\n'}No account needed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
