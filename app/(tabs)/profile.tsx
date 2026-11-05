import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/constants/MedColors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { API_BASE_URL } from '@/constants/api';
import { useUser } from '@/contexts/UserContext';
import { getDeviceId } from '@/utils/storage';
import { getAllMeds } from '@/utils/medsStore';
import { rescheduleAll } from '@/utils/notifications';

export default function ProfileScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { name, setName, reset } = useUser();

  const [user, setUser] = useState<{
    full_name: string;
    email: string;
    avatar_url: string;
    caregiver_email: string;
  } | null>({
    full_name: name || 'Jonathan',
    email: '',
    avatar_url: '',
    caregiver_email: '',
  });
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: name || 'Jonathan',
    avatar_url: '',
    caregiver_email: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const userId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        headers: { 'x-user-id': userId },
      });
      if (response.status === 404) {
        const fallbackName = name || 'Jonathan';
        setUser({
          full_name: fallbackName,
          email: '',
          avatar_url: '',
          caregiver_email: '',
        });
        setFormData({
          full_name: fallbackName,
          avatar_url: '',
          caregiver_email: '',
        });
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      setUser(data);
      setFormData({
        full_name: data.full_name || name || 'Jonathan',
        avatar_url: data.avatar_url || '',
        caregiver_email: data.caregiver_email || '',
      });
    } catch (err) {
      console.log('[Profile] Using local profile fallback:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const trimmedName = formData.full_name.trim() || 'Jonathan';
      await setName(trimmedName);
      setUser(prev => ({
        full_name: trimmedName,
        email: prev?.email || '',
        avatar_url: formData.avatar_url,
        caregiver_email: formData.caregiver_email,
      }));
      const userId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId 
        },
        body: JSON.stringify({ ...formData, full_name: trimmedName }),
      });
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setUser(data);
        }
      }
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');

      // Re-schedule all local notifications with the updated name so
      // reminders stop using the old name
      try {
        const meds = await getAllMeds();
        await rescheduleAll(meds, trimmedName);
      } catch (reschedErr) {
        console.warn('[Profile] Failed to reschedule notifications after name change:', reschedErr);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This action is permanent and will delete all your medication history.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const userId = await getDeviceId();
              await fetch(`${API_BASE_URL}/api/user`, {
                method: 'DELETE',
                headers: { 'x-user-id': userId },
              });
              await reset();
              Alert.alert('Deleted', 'Your account has been removed.', [
                { text: 'OK', onPress: () => router.replace('/welcome') }
              ]);
            } catch (e) {
              Alert.alert('Error', 'Could not delete account.');
            }
          } 
        },
      ]
    );
  };

  const sectionStyle = {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
    marginBottom: 20,
  };

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 100 }}
    >
      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <View style={{ 
          width: 100, 
          height: 100, 
          borderRadius: 50, 
          backgroundColor: COLORS.primary, 
          overflow: 'hidden', 
          borderWidth: 4, 
          borderColor: COLORS.border,
          marginBottom: 16 
        }}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: 'bold' }}>
                {user?.full_name?.[0] || 'U'}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.text }}>
          {user?.full_name || 'User Profile'}
        </Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.primary, marginBottom: 8 }}>
          Personal Information
        </Text>
        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Full Name</Text>
            {editing ? (
              <TextInput 
                style={inputStyle} 
                value={formData.full_name} 
                onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))} 
                placeholder="Your name" 
              />
            ) : (
              <Text style={{ fontSize: 16, color: COLORS.text }}>{user?.full_name || 'Not set'}</Text>
            )}
          </View>
          <View>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>Caregiver Email</Text>
            {editing ? (
              <TextInput 
                style={inputStyle} 
                value={formData.caregiver_email} 
                onChangeText={(text) => setFormData(prev => ({ ...prev, caregiver_email: text }))} 
                placeholder="caregiver@email.com" 
                keyboardType="email-address"
              />
            ) : (
              <Text style={{ fontSize: 16, color: COLORS.text }}>{user?.caregiver_email || 'Not set'}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.primary, marginBottom: 8 }}>
          Account Preferences
        </Text>
        <View style={{ gap: 16 }}>
          <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, color: COLORS.text }}>Push Notifications</Text>
            <View style={{ width: 40, height: 20, backgroundColor: COLORS.primary, borderRadius: 10 }} />
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, color: COLORS.text }}>Private Mode</Text>
            <View style={{ width: 40, height: 20, backgroundColor: COLORS.border, borderRadius: 10 }} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ gap: 12, marginTop: 10 }}>
        <AnimatedPressable 
          onPress={() => {
            if (editing) handleSave();
            else setEditing(true);
          }}
          style={{ 
            backgroundColor: editing ? COLORS.primary : COLORS.surfaceSecondary, 
            borderRadius: 16, 
            padding: 16, 
            alignItems: 'center', 
            borderWidth: 1, 
            borderColor: editing ? COLORS.primary : COLORS.border 
          }}
        >
          <Text style={{ color: editing ? '#fff' : COLORS.text, fontWeight: '700', fontSize: 16 }}>
            {editing ? 'Save Changes' : 'Edit Profile'}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable 
          onPress={handleDeleteAccount}
          style={{ 
            backgroundColor: 'transparent', 
            borderRadius: 16, 
            padding: 16, 
            alignItems: 'center', 
            borderWidth: 1, 
            borderColor: COLORS.danger 
          }}
        >
          <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 14 }}>
            Delete Account
          </Text>
        </AnimatedPressable>
      </View>
    </ScrollView>
  );
}
