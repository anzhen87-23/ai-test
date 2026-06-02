import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { teamsApi } from '../api';

type Member = { id: number; email: string; role: string };
type Props = {
  route?: { params?: { teamId: number; teamName: string; userRole?: string } };
  token: string;
  navigation: any;
};

const ROLE_COLORS: Record<string, string> = { admin: '#FF3B3B', editor: '#2979FF', viewer: '#FFC107' };
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
const ROLES = ['admin', 'editor', 'viewer'] as const;

export default function TeamSettingsScreen({ route, token, navigation }: Props) {
  const teamId = route?.params?.teamId ?? 0;
  const teamName = route?.params?.teamName ?? '';
  const [members, setMembers] = useState<Member[]>([]);
  const [teamDisplayName, setTeamDisplayName] = useState(teamName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(teamName);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteMenu, setInviteMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roleMenuFor, setRoleMenuFor] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const { members: m } = await teamsApi.members(teamId, token);
      setMembers(m || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }, [teamId, token]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setLoading(true);
    try {
      await teamsApi.update(teamId, nameInput.trim(), token);
      setTeamDisplayName(nameInput.trim());
      setEditingName(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  };

  const updateRole = async (userId: number, role: string) => {
    try {
      await teamsApi.updateMember(teamId, userId, role, token);
      setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role } : m));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const removeMember = (userId: number, email: string) => {
    Alert.alert('Remove', `Remove ${email} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => doRemoveMember(userId),
      },
    ]);
  };

  const doRemoveMember = async (userId: number) => {
    try {
      await teamsApi.removeMember(teamId, userId, token);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    try {
      await teamsApi.addMember(teamId, inviteEmail.trim(), inviteRole, token);
      setInviteEmail('');
      await loadMembers();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  };

  const deleteTeam = () => {
    Alert.alert('Delete Team', `Delete "${teamDisplayName}" and all its notes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => doDeleteTeam(),
      },
    ]);
  };

  const doDeleteTeam = async () => {
    try {
      await teamsApi.remove(teamId, token);
      navigation.navigate('Notes');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <Text style={styles.memberEmail}>{item.email}</Text>
        <TouchableOpacity
          style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] }]}
          onPress={() => setRoleMenuFor(roleMenuFor === item.id ? null : item.id)}
        >
          <Text style={styles.roleBadgeText}>{ROLE_LABELS[item.role]}</Text>
          <Text style={styles.roleBadgeArrow}>▾</Text>
        </TouchableOpacity>
        {roleMenuFor === item.id && (
          <View style={styles.roleMenu}>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleMenuItem, item.role === role && styles.roleMenuItemActive]}
                onPress={() => { updateRole(item.id, role); setRoleMenuFor(null); }}
              >
                <View style={[styles.roleMenuDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <Text style={[styles.roleMenuLabel, item.role === role && styles.roleMenuLabelActive]}>{ROLE_LABELS[role]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeMember(item.id, item.email)}
      >
        <Text style={styles.removeBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Team Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Name</Text>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={loading}>
                <Text style={styles.saveBtnText}>{loading ? '...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingName(false); setNameInput(teamDisplayName); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={styles.nameDisplay}>{teamDisplayName}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          <FlatList
            data={members}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMember}
            scrollEnabled={false}
          />
        </View>

        {/* Invite */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Member</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.emailInput}
              placeholder="Email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.roleDropdown}
              onPress={() => setInviteMenu(!inviteMenu)}
            >
              <Text style={styles.roleDropdownText}>{ROLE_LABELS[inviteRole]}</Text>
            </TouchableOpacity>
          </View>
          {inviteMenu && (
            <View style={styles.roleMenu}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={styles.roleMenuItem}
                  onPress={() => { setInviteRole(role); setInviteMenu(false); }}
                >
                  <View style={[styles.roleMenuDot, { backgroundColor: ROLE_COLORS[role] }]} />
                  <Text style={styles.roleMenuLabel}>{ROLE_LABELS[role]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={inviteMember}
            disabled={loading || !inviteEmail.trim()}
          >
            <Text style={styles.inviteBtnText}>{loading ? 'Inviting...' : 'Invite'}</Text>
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteTeam}>
            <Text style={styles.deleteBtnText}>Delete Team</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 56,
    backgroundColor: '#1a1a2e',
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 24, color: 'white', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
  content: { flex: 1 },

  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e8e8f0' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c7c9a',
    textTransform: 'uppercase',
    letterSpacing: 0.08,
    marginBottom: 12,
  },

  // Name
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    padding: 10,
    borderWidth: 2,
    borderColor: '#2979FF',
    borderRadius: 8,
    fontSize: 16,
  },
  saveBtn: { padding: 10, backgroundColor: '#2979FF', borderRadius: 6, paddingHorizontal: 14 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: '#7c7c9a', fontSize: 13 },
  nameDisplay: { fontSize: 18, fontWeight: '600', color: '#1a1a2e' },

  // Members
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f5',
  },
  memberInfo: { flex: 1, marginRight: 8 },
  memberEmail: { fontSize: 14, fontWeight: '500', color: '#1a1a2e' },
  roleBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleBadgeText: { color: 'white', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleSelect: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#e8e8f0',
    borderRadius: 6,
    backgroundColor: 'white',
  },
  roleSelectText: { fontSize: 11, fontWeight: '600', color: '#2979FF' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 20, color: '#FF3B3B', fontWeight: '700' },

  // Invite
  inviteRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  emailInput: {
    flex: 1,
    padding: 10,
    borderWidth: 2,
    borderColor: '#e8e8f0',
    borderRadius: 8,
    fontSize: 14,
  },
  roleDropdown: {
    padding: 10,
    borderWidth: 2,
    borderColor: '#e8e8f0',
    borderRadius: 8,
    backgroundColor: 'white',
    minWidth: 80,
    alignItems: 'center',
  },
  roleDropdownText: { fontSize: 12, fontWeight: '600', color: '#1a1a2e' },
  roleMenu: {
    marginTop: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8f0',
    padding: 4,
  },
  roleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: 6,
  },
  roleMenuDot: { width: 10, height: 10, borderRadius: 5 },
  roleMenuLabel: { fontSize: 14, fontWeight: '500' },
  inviteBtn: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2979FF',
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },

  // Danger
  dangerSection: { borderBottomWidth: 0, paddingTop: 24 },
  deleteBtn: {
    padding: 14,
    backgroundColor: '#FF3B3B',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
