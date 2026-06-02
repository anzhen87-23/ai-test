import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usersApi } from '../api';

export default function ProfileScreen({ navigation, token }: { navigation: any; token: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { user } = await usersApi.getProfile(token);
      setEmail(user.email || '');
      setDisplayName(user.display_name || '');
      setAvatar(user.avatar || '');
    } catch (err) {
      Alert.alert('Error', 'Failed to load profile');
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { user } = await usersApi.updateProfile({
        displayName: displayName.trim() || null,
        avatar: avatar.trim() || null,
        email: email.trim() || null,
      }, token);
      Alert.alert('Success', 'Profile saved');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { Alert.alert('Error', 'Current password is required'); return; }
    if (!newPassword) { Alert.alert('Error', 'New password is required'); return; }
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    setSaving(true);
    try {
      const { user } = await usersApi.updateProfile({ currentPassword, newPassword }, token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2979FF" />
      </View>
    );
  }

  const getInitials = () => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  const handleAvatarTap = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限不足', '需要相册权限才能选择头像');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const { avatar: avatarUrl } = await usersApi.uploadAvatar(result.assets[0].uri, token);
      setAvatar(avatarUrl);
      // Refresh full profile
      const { user: updated } = await usersApi.getProfile(token);
      setEmail(updated.email || '');
      setDisplayName(updated.display_name || '');
      Alert.alert('成功', '头像已更新');
    } catch (err: any) {
      Alert.alert('错误', err.message);
    }
    setUploading(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>&larr;</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>个人设置</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Avatar preview */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarTap} activeOpacity={0.7} disabled={uploading}>
          {uploading ? (
            <View style={[styles.avatarImage, styles.avatarImageLoading]}>
              <ActivityIndicator color="white" />
            </View>
          ) : avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarName}>{displayName || '未设置昵称'}</Text>
        <Text style={styles.avatarEmail}>{email}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>基本资料</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'security' && styles.tabActive]}
          onPress={() => setActiveTab('security')}
        >
          <Text style={[styles.tabText, activeTab === 'security' && styles.tabTextActive]}>安全设置</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'profile' && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>昵称</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>邮箱</Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveBtnText}>保存</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'security' && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>当前密码</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>新密码</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>确认新密码</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveBtnText}>修改密码</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafbff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#3a3a3a',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 22, color: 'white' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
  avatarSection: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2979FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarImageLoading: { backgroundColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: 'white' },
  avatarName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  avatarEmail: { fontSize: 13, color: '#7c7c9a', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2979FF',
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#7c7c9a' },
  tabTextActive: { color: '#2979FF', fontWeight: '700' },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#7c7c9a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a2e',
  },
  saveBtn: {
    backgroundColor: '#2979FF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
