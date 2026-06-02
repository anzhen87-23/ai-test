import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Alert, ScrollView,
} from 'react-native';
import { notesApi, foldersApi, searchApi, teamsApi } from '../api';

const COLORS = ['#2979FF', '#FF3B3B', '#FFC107'];

type Props = { navigation: any; token: string; onLogout: () => void };

function renderHighlightedText(text: string) {
  // The API returns text with <mark>...</mark> tags for highlights
  const parts = text.split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <Text key={i} style={{ color: '#FFC107', fontWeight: '700' }}>{part.slice(6, -7)}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

function getWordCount(note: any): number {
  return note.word_count ?? getBlockContentLength(note.blocks);
}

function getBlockContentLength(blocks: any[]): number {
  if (!blocks || blocks.length === 0) return 0;
  return blocks.reduce((sum, b) => sum + (b.content || '').length, 0);
}

export default function NoteListScreen({ navigation, token, onLogout }: Props) {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [teamModal, setTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');

  const loadTeams = useCallback(async () => {
    try {
      const { teams: t } = await teamsApi.list(token);
      setTeams(t || []);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }, [token]);

  const loadData = useCallback(async () => {
    try {
      if (selectedTeamId) {
        const { notes: n } = await teamsApi.notes(selectedTeamId, token);
        setNotes(n || []);
      } else {
        const [f, n] = await Promise.all([
          foldersApi.list(token),
          notesApi.list(token),
        ]);
        setFolders(f.folders || []);
        setNotes(n.notes || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, [token, selectedTeamId]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadTeams();
    setRefreshing(false);
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { notes } = await searchApi.query(searchQuery, token);
        setSearchResults(notes || []);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const displayedNotes = searchQuery.trim() ? searchResults :
    selectedFolderId ? notes.filter((n) => n.folder_id === selectedFolderId) : notes;

  const createNote = async () => {
    try {
      if (selectedTeamId) {
        const { note } = await teamsApi.createNote(selectedTeamId, 'Untitled', token);
        setNotes((prev) => [note, ...prev]);
        navigation.navigate('Editor', { noteId: note.id, teamId: selectedTeamId });
      } else {
        const { note } = await notesApi.create({ title: 'Untitled', folderId: selectedFolderId }, token);
        setNotes((prev) => [note, ...prev]);
        navigation.navigate('Editor', { noteId: note.id });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create note');
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      const { folder } = await foldersApi.create(folderName.trim(), token);
      setFolders((prev) => [...prev, folder]);
      setFolderModal(false);
      setFolderName('');
    } catch (err) {
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const renameFolder = (id: number, currentName: string) => {
    Alert.prompt('Rename Folder', 'New name:', (name) => {
      if (!name || !name.trim()) return;
      foldersApi.update(id, { name: name.trim() }, token)
        .then(({ folder }) => {
          setFolders((prev: { id: number }[]) => prev.map((f: { id: number }) => (f.id === id ? folder : f)));
        })
        .catch((err) => {
          console.error('Failed to rename folder:', err);
          Alert.alert('Error', 'Failed to rename folder');
        });
    }, 'plain-text', currentName);
  };

  const deleteFolder = (id: number) => {
    Alert.alert('Delete Folder', 'Delete this folder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          foldersApi.remove(id, token)
            .then(() => {
              setFolders((prev: { id: number }[]) => prev.filter((f: { id: number }) => f.id !== id));
              if (selectedFolderId === id) setSelectedFolderId(null);
            })
            .catch((err) => {
              console.error('Failed to delete folder:', err);
              Alert.alert('Error', 'Failed to delete folder');
            });
        },
      },
    ]);
  };

  const createTeam = async () => {
    if (!teamName.trim()) return;
    try {
      const { team } = await teamsApi.create(teamName.trim(), token);
      setTeams((prev) => [team, ...prev]);
      setSelectedTeamId(team.id);
      setSelectedFolderId(null);
      setTeamModal(false);
      setTeamName('');
      setNotes([]);
    } catch (err) {
      Alert.alert('Error', 'Failed to create team');
    }
  };

  const selectTeam = (id: number | null) => {
    if (selectedTeamId === id) {
      setSelectedTeamId(null);
    } else {
      setSelectedTeamId(id);
      setSelectedFolderId(null);
    }
  };

  const selectFolder = (id: number | null) => {
    setSelectedFolderId(selectedFolderId === id ? null : id);
  };

  const folderSettings = (id: number, name: string) => {
    Alert.alert(name, 'Choose action', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rename', onPress: () => renameFolder(id, name) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFolder(id) },
    ]);
  };

  const deleteNote = (id: number) => {
    Alert.alert('Delete', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => doDeleteNote(id),
      },
    ]);
  };

  const doDeleteNote = async (id: number) => {
    try {
      await notesApi.remove(id, token);
      setNotes((prev: any[]) => prev.filter((n: any) => n.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to delete note');
    }
  };

  const getFolderName = (id: number) => {
    return folders.find((f: { id: number; name: string }) => f.id === id)?.name || 'Folder';
  };

  const getTeamName = (id: number) => {
    return teams.find((t: { id: number; name: string }) => t.id === id)?.name || 'Team';
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'admin') return '#FF3B3B';
    if (role === 'editor') return '#2979FF';
    return '#FFC107';
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.noteItem}
      onPress={() => navigation.navigate('Editor', { noteId: item.id, teamId: selectedTeamId })}
      onLongPress={() => deleteNote(item.id)}
    >
      <View style={[styles.noteDot, { backgroundColor: COLORS[index % 3] }]} />
      <View style={styles.noteItemContent}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {isSearching ? renderHighlightedText(item.title || 'Untitled') : item.title || 'Untitled'}
        </Text>
        {isSearching && item.snippet && (
          <Text style={styles.noteSnippet} numberOfLines={2}>
            {renderHighlightedText(item.snippet)}
          </Text>
        )}
        {!isSearching && (
          <Text style={styles.noteDate}>
            {getWordCount(item)} 字 · {new Date(item.updated_at).toLocaleDateString()}
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNote(item.id)}>
        <Text style={styles.deleteBtnText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const isSearching = searchQuery.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitleRed}>安</Text>
          <Text style={styles.headerTitleYellow}>振</Text>
          <Text style={styles.headerTitleBlue}>-AI-</Text>
          <Text style={styles.headerTitleRed}>笔</Text>
          <Text style={styles.headerTitleYellow}>记</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: '#FF3B3B' }]} onPress={() => setTeamModal(true)}>
            <Text style={styles.headerBtnText}>👥+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: '#FFC107' }]} onPress={() => setFolderModal(true)}>
            <Text style={styles.headerBtnText}>📁+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: '#2979FF' }]} onPress={createNote}>
            <Text style={styles.headerBtnText}>📝+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: '#2d2d2d' }]} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerBtnText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: '#FF3B3B' }]} onPress={onLogout}>
            <Text style={styles.headerBtnText}>退出</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Teams + Folders */}
      <ScrollView style={styles.chipBar} horizontal showsHorizontalScrollIndicator={false}>
        {teams.length > 0 && (
          <>
            {teams.map((t: { id: number; name: string; role: string }) => (
              <View key={t.id} style={styles.teamChipWrapper}>
                <TouchableOpacity
                  style={[styles.chip, selectedTeamId === t.id && styles.chipActive]}
                  onPress={() => selectTeam(t.id)}
                >
                  <Text style={[styles.chipText, selectedTeamId === t.id && styles.chipTextActive]}>
                    {t.name}
                  </Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(t.role) }]}>
                    <Text style={styles.roleBadgeText}>{t.role}</Text>
                  </View>
                </TouchableOpacity>
                {t.role === 'admin' && (
                  <TouchableOpacity
                    style={styles.teamSettingsChip}
                    onPress={() => navigation.navigate('TeamSettings', { teamId: t.id, teamName: t.name, userRole: t.role })}
                  >
                    <Text style={styles.teamSettingsChipText}>⚙</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}
        {!selectedTeamId && (
          <>
            <TouchableOpacity
              style={[styles.chip, !selectedFolderId && styles.chipActive]}
              onPress={() => setSelectedFolderId(null)}
            >
              <Text style={[styles.chipText, !selectedFolderId && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {folders.map((f: { id: number; name: string }) => (
              <View key={f.id} style={styles.folderChipWrapper}>
                <TouchableOpacity
                  style={styles.folderSettingsChip}
                  onPress={() => folderSettings(f.id, f.name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.folderSettingsChipText}>⚙</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, selectedFolderId === f.id && styles.chipActive]}
                  onPress={() => selectFolder(f.id)}
                >
                  <Text style={[styles.folderChipText, selectedFolderId === f.id && styles.chipTextActive]}>
                    {f.name}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Section title */}
      <Text style={styles.sectionTitle}>
        {isSearching ? 'Search Results' : selectedTeamId ? getTeamName(selectedTeamId) : selectedFolderId ? getFolderName(selectedFolderId) : 'Notes'}
      </Text>

      {/* Notes list */}
      <FlatList
        data={displayedNotes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isSearching ? 'No matching notes' : selectedTeamId ? 'No notes in this team' : selectedFolderId ? 'No notes in this folder' : 'No notes yet'}
          </Text>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Create folder modal */}
      {folderModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name"
              value={folderName}
              onChangeText={setFolderName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFolderModal(false)}>
                <Text style={[styles.modalBtnText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreateBtn} onPress={createFolder}>
                <Text style={[styles.modalBtnText, { color: 'white' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Create team modal */}
      {teamModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Team</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Team name"
              value={teamName}
              onChangeText={setTeamName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTeamModal(false)}>
                <Text style={[styles.modalBtnText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCreateBtn, { backgroundColor: '#FF3B3B' }]} onPress={createTeam}>
                <Text style={[styles.modalBtnText, { color: 'white' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbff' },
  header: {
    flexDirection: 'column',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#3a3a3a',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  headerTitleRed: { fontSize: 22, fontWeight: '900', color: '#FF3B3B' },
  headerTitleYellow: { fontSize: 22, fontWeight: '900', color: '#FFC107' },
  headerTitleBlue: { fontSize: 22, fontWeight: '900', color: '#2979FF' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  searchBar: { padding: 12, backgroundColor: '#2d2d2d' },
  searchInput: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  chipBar: { flexDirection: 'row', backgroundColor: '#2d2d2d', maxHeight: 56 },
  teamChipWrapper: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 4 },
  folderChipWrapper: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 4, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginLeft: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(255,0,0,0.06)',
    borderColor: '#FF3B3B',
  },
  chipText: { color: '#333', fontSize: 12, fontWeight: '500' },
  folderChipText: { color: '#2979FF', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FF3B3B', fontWeight: '700' },
  roleBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  roleBadgeText: { color: 'white', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  teamSettingsChip: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  teamSettingsChipText: { color: '#333', fontSize: 12 },
  folderSettingsChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderSettingsChipText: { fontSize: 14, color: '#333' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1a1a2e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  listContent: { paddingBottom: 80 },
  noteItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  noteDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  noteItemContent: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '500' },
  noteSnippet: { fontSize: 12, color: '#9b9a97', marginTop: 2, lineHeight: 18 },
  noteDate: { fontSize: 11, color: '#9b9a97', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 20, color: '#FF3B3B', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 48, color: '#9b9a97', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e8', alignItems: 'center' },
  modalCreateBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2979FF', alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '600' },
});
