import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Settings, User, Trash2, Info, Bell, Check } from 'lucide-react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useColors } from '@/constants/MedColors';
import { useUser } from '@/contexts/UserContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';

export default function SettingsScreen() {
  const COLORS = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { name, setName, reset } = useUser();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      Notifications.getPermissionsAsync()
        .then((perm) => {
          console.log('[Settings] Notification permission status:', perm.status);
          setNotifStatus(perm.status as 'granted' | 'denied' | 'undetermined');
        })
        .catch(() => setNotifStatus(null));
    }, [])
  );

  const handleOpenNotifSettings = () => {
    console.log('[Settings] Open notification settings pressed');
    Linking.openSettings();
  };

  const handleEditName = () => {
    console.log('[Settings] Edit name tapped');
    setNameInput(name ?? '');
    setEditing(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    console.log('[Settings] Save name pressed:', trimmed);
    if (!trimmed) return;
    setSaving(true);
    try {
      await setName(trimmed);
      setEditing(false);
      console.log('[Settings] Name saved successfully');
    } catch (err) {
      console.error('[Settings] Failed to save name:', err);
      Alert.alert('Error', "Couldn't save your name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    console.log('[Settings] Cancel edit name');
    setEditing(false);
    setNameInput(name ?? '');
  };

  const handleReset = () => {
    console.log('[Settings] Reset all data pressed');
    Alert.alert(
      'Reset all data?',
      'This will delete all your medications, dose history, and your name. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[Settings] Reset cancelled') },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: async () => {
            console.log('[Settings] Confirmed reset all data');
            try {
              await reset();
              console.log('[Settings] Reset complete, navigating to welcome');
              router.replace('/welcome');
            } catch (err) {
              console.error('[Settings] Failed to reset:', err);
              Alert.alert('Error', "Couldn't reset. Try again.");
            }
          },
        },
      ]
    );
  };

  const cardShadow = isDark
    ? undefined
    : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)';

  const displayName = name ?? 'Not set';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 120,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <Settings size={28} color={COLORS.primary} />
        <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 }}>
          Settings
        </Text>
      </View>

      {/* Profile card */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: cardShadow,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: editing ? 16 : 0 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>
              Your name
            </Text>
            {editing ? null : (
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>
                {displayName}
              </Text>
            )}
          </View>
          {editing ? null : (
            <AnimatedPressable
              onPress={handleEditName}
              style={{
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.primary }}>
                Edit
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {editing && (
          <View style={{ gap: 12 }}>
            <TextInput
              style={{
                backgroundColor: COLORS.surfaceSecondary,
                borderRadius: 12,
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
      {Platform.OS !== 'web' && (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 20,
            padding: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            boxShadow: cardShadow,
          }}
        >
          <AnimatedPressable
            onPress={notifStatus !== 'granted' ? handleOpenNotifSettings : undefined}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              borderRadius: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: COLORS.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} color={COLORS.primary} />
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
              <Check size={18} color="#22C55E" />
            ) : notifStatus === 'denied' ? (
              <Bell size={18} color={COLORS.textTertiary} />
            ) : null}
          </AnimatedPressable>
        </View>
      )}

      {/* Danger zone */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 20,
          padding: 4,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: cardShadow,
        }}
      >
        <AnimatedPressable
          onPress={handleReset}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.danger + '15',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={20} color={COLORS.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.danger }}>
              Reset all data
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
              Delete all meds, doses, and your name
            </Text>
          </View>
        </AnimatedPressable>
      </View>

      {/* About */}
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: cardShadow,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info size={20} color={COLORS.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
              Dosed · Pillkart LLC
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
              Version {appVersion}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
