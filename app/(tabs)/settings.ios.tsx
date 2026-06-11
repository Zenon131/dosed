import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  useColorScheme,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { SymbolView } from 'expo-symbols';
import Constants from 'expo-constants';
import { useColors } from '@/constants/MedColors';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

export default function SettingsScreenIOS() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { name, setName, reset } = useUser();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const cardShadow = isDark ? undefined : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.04)';

  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync()
        .then((perm) => {
          console.log('[Settings iOS] Notification permission status:', perm.status);
          setNotifStatus(perm.status as 'granted' | 'denied' | 'undetermined');
        })
        .catch(() => setNotifStatus(null));
    }, [])
  );

  const handleOpenNotifSettings = () => {
    console.log('[Settings iOS] Open notification settings pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openSettings();
  };

  const handleEditName = () => {
    console.log('[Settings iOS] Edit name tapped');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNameInput(name ?? '');
    setEditing(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    console.log('[Settings iOS] Save name pressed:', trimmed);
    if (!trimmed) return;
    setSaving(true);
    try {
      await setName(trimmed);
      setEditing(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[Settings iOS] Name saved successfully');
    } catch (err) {
      console.error('[Settings iOS] Failed to save name:', err);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', "Couldn't save your name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    console.log('[Settings iOS] Cancel edit name');
    setEditing(false);
    setNameInput(name ?? '');
  };

  const handleReset = () => {
    console.log('[Settings iOS] Reset all data pressed');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Reset all data?',
      "This will delete all your medications, dose history, and your name. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[Settings iOS] Reset cancelled') },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: async () => {
            console.log('[Settings iOS] Confirmed reset all data');
            try {
              await reset();
              console.log('[Settings iOS] Reset complete, navigating to welcome');
              router.replace('/welcome');
            } catch (err) {
              console.error('[Settings iOS] Failed to reset:', err);
              Alert.alert('Error', "Couldn't reset. Try again.");
            }
          },
        },
      ]
    );
  };

  const displayName = name ?? 'Not set';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
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
      >
        <View style={{ paddingTop: 8, gap: 16 }}>
          {/* Profile card */}
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
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderCurve: 'continuous',
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name="person.fill" size={22} tintColor={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>
                  Your name
                </Text>
                {editing ? null : (
                  <Text style={{ fontSize: 17, fontWeight: '600', color: COLORS.text }}>
                    {displayName}
                  </Text>
                )}
              </View>
              {editing ? null : (
                <AnimatedPressable onPress={handleEditName}>
                  <Text style={{ fontSize: 16, color: COLORS.primary }}>Edit</Text>
                </AnimatedPressable>
              )}
            </View>

            {editing && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                <TextInput
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    padding: 14,
                    fontSize: 16,
                    color: COLORS.text,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  autoCapitalize="words"
                  placeholder="Your name"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <AnimatedPressable
                    onPress={handleCancelEdit}
                    style={{
                      flex: 1,
                      backgroundColor: COLORS.surfaceSecondary,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      padding: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>
                      Cancel
                    </Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={handleSaveName}
                    disabled={saving || !nameInput.trim()}
                    style={{
                      flex: 1,
                      backgroundColor: COLORS.primary,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      padding: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            )}
          </View>

          {/* Notifications */}
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
            <AnimatedPressable
              onPress={notifStatus !== 'granted' ? handleOpenNotifSettings : undefined}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name="bell.fill" size={18} tintColor={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>
                  Notifications
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                  {notifStatus === 'granted' ? 'Reminders are enabled' : notifStatus === 'denied' ? 'Tap to open settings' : 'Checking...'}
                </Text>
              </View>
              {notifStatus === 'granted' ? (
                <SymbolView name="checkmark.circle.fill" size={20} tintColor="#22C55E" />
              ) : (
                <SymbolView name="chevron.right" size={14} tintColor={COLORS.textTertiary} />
              )}
            </AnimatedPressable>
          </View>

          {/* Reset */}
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
            <AnimatedPressable
              onPress={handleReset}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: COLORS.danger + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name="trash.fill" size={18} tintColor={COLORS.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.danger }}>
                  Reset all data
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                  Delete all meds, doses, and your name
                </Text>
              </View>
              <SymbolView name="chevron.right" size={14} tintColor={COLORS.textTertiary} />
            </AnimatedPressable>
          </View>

          {/* About */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: cardShadow,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name="info.circle.fill" size={18} tintColor={COLORS.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>
                Dosed
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                Version {appVersion}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
