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
import { useColors } from '@/constants/MedColors';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { API_BASE_URL } from '@/constants/api';

export default function ProfileScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<{
    full_name: string;
    email: string;
    avatar_url: string;
    caregiver_email: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
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
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        headers: { 'x-user-id': 'test-user-123' },
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      setUser(data);
      setFormData({
        full_name: data.full_name || '',
        avatar_url: data.avatar_url || '',
        caregiver_email: data.caregiver_email || '',
      });
    } catch (err) {
      console.error('Fetch user error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': 'test-user-123' 
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Update failed');
      const data = await response.json();
      setUser(data);
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
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
              await fetch(`${API_BASE_URL}/api/user`, {
                method: 'DELETE',
                headers: { 'x-user-id': 'test-user-123' },
              });
              Alert.alert('Deleted', 'Your account has been removed.');
            } catch (e) {
              Alert.alert('Error', 'Could not delete account.');
            }
          } 
        },
      ]
    );
  };

  const sectionStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
    marginBottom: 20,
  };

  const inputStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 4 }}>
          {user?.email}
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
