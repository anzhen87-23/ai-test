import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity,
  Alert, Image, Linking, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { notesApi, attachmentsApi, teamsApi, BASE_URL } from '../api';

type Block = { id?: number; type: string; content: string; order: number; checked?: boolean };

type Props = {
  route: { params: { noteId: number; teamId?: number | null } };
  token: string;
};

const BLOCK_TYPES: { type: string; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: 'Aa' },
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'bullet_list', label: 'Bullet List', icon: '•' },
  { type: 'todo', label: 'Todo', icon: '☐' },
  { type: 'divider', label: 'Divider', icon: '─' },
  { type: 'image', label: 'Image', icon: '\u{1F304}' },
];

const PREVIEWABLE_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
const PREVIEWABLE_TEXT_MIMES = ['text/plain', 'text/csv', 'text/html', 'text/xml', 'application/json', 'text/javascript'];

function isImage(mime: string) { return PREVIEWABLE_IMAGE_MIMES.includes(mime); }
function isPdf(mime: string) { return mime === 'application/pdf'; }
function isText(mime: string) { return PREVIEWABLE_TEXT_MIMES.includes(mime); }
function isPreviewable(mime: string) { return isImage(mime) || isPdf(mime) || isText(mime); }

export default function NoteEditorScreen({ route, token }: Props) {
  const { noteId, teamId } = route.params;
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([] as Block[]);
  const [saved, setSaved] = useState(true);
  const [attachments, setAttachments] = useState([] as any[]);
  const [previewAttachment, setPreviewAttachment] = useState(null as any);
  const [textContent, setTextContent] = useState(null as string | null);
  const [textLoading, setTextLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // --- Note loading ---
  const loadNote = useCallback(async () => {
    try {
      let note;
      if (teamId) {
        const resp = await teamsApi.notes(teamId, token);
        note = resp.notes?.find((n: { id: number }) => n.id === noteId);
      } else {
        const { note: n } = await notesApi.get(noteId, token);
        note = n;
      }
      setTitle(note.title || '');
      setBlocks(note.blocks || [{ type: 'text', content: '', order: 0 }]);
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  }, [noteId, teamId, token]);

  useEffect(() => { loadNote(); }, [loadNote]);

  // --- Attachments ---
  const loadAttachments = useCallback(async () => {
    try {
      const { attachments: a } = await attachmentsApi.list(noteId, token);
      setAttachments(a || []);
    } catch { /* ignore */ }
  }, [noteId, token]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  // --- Title save ---
  const saveTitle = async () => {
    const t = titleInput.trim();
    if (!t || t === title) {
      setEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      if (teamId) {
        await teamsApi.update(teamId, t, token);
      } else {
        await notesApi.update(noteId, { title: t }, token);
      }
      setTitle(t);
      setEditingTitle(false);
      setSaved(true);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
    setTitleSaving(false);
  };

  // --- Block save ---
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const current = blocksRef.current;
      try {
        const blocksPayload = current.map((b: Block, i: number) => ({ type: b.type, content: b.content, order: i }));
        if (teamId) {
          await teamsApi.saveBlocks(teamId, noteId, blocksPayload, token);
        } else {
          await notesApi.saveBlocks(noteId, blocksPayload, token);
        }
        setSaved(true);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 500);
    setSaved(false);
  }, [noteId, teamId, token]);

  const updateBlockContent = (index: number, content: string) => {
    setBlocks((prev: Block[]) => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
    if (content === '/') {
      setSlashMenuIndex(index);
    } else {
      setSlashMenuIndex(null);
    }
  };

  const triggerSave = useCallback(() => {
    scheduleSave();
  }, [scheduleSave]);

  const addBlockAfter = (index: number, type = 'text') => {
    setBlocks((prev: Block[]) => {
      const next = [...prev];
      next.splice(index + 1, 0, { type, content: '', order: 0 });
      return next;
    });
    triggerSave();
  };

  const deleteBlock = (index: number) => {
    if (blocks.length <= 1) {
      setBlocks([{ type: 'text', content: '', order: 0 }]);
      triggerSave();
      return;
    }
    setBlocks((prev: Block[]) => prev.filter((_, i) => i !== index));
    triggerSave();
  };

  const applyBlockType = (index: number, type: string) => {
    setBlocks((prev: Block[]) => {
      const next = [...prev];
      next[index] = { ...next[index], type, content: '' };
      return next;
    });
    setSlashMenuIndex(null);
    triggerSave();
  };

  const toggleTodoChecked = (index: number) => {
    setBlocks((prev: Block[]) => {
      const next = [...prev];
      next[index] = { ...next[index], checked: !next[index].checked };
      return next;
    });
    triggerSave();
  };

  const handleBlockSubmit = (index: number) => {
    addBlockAfter(index);
  };

  const handleBlockBlur = (index: number, text: string) => {
    updateBlockContent(index, text);
    triggerSave();
  };

  const handleBackspace = (index: number) => {
    if (blocks[index].content === '') {
      deleteBlock(index);
    }
  };

  // --- Attachment helpers ---
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const deleteAttachment = async (id: number) => {
    Alert.alert('Delete', 'Delete this attachment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await attachmentsApi.remove(noteId, id, token);
            setAttachments((prev) => prev.filter((a: any) => a.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete attachment');
          }
        },
      },
    ]);
  };

  const uploadFiles = async (files: { uri: string; name: string; type: string }[]) => {
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('file', {
          uri: f.uri,
          name: f.name,
          type: f.type,
        } as any);
      }
      const res = await fetch(`${BASE_URL}/api/notes/${noteId}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        Alert.alert('Error', 'Failed to upload attachment');
        setUploading(false);
        return;
      }
      loadAttachments();
    } catch {
      Alert.alert('Error', 'Failed to upload attachment');
    }
    setUploading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      await uploadFiles(result.assets.map((a) => ({ uri: a.uri, name: a.fileName || 'image', type: a.mimeType || 'image/jpeg' })));
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets) {
      await uploadFiles(result.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream' })));
    }
  };

  const showUploadOptions = () => {
    Alert.alert('Add Attachment', 'Choose source', [
      { text: 'Photo Library', onPress: pickImage },
      { text: 'File', onPress: pickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // --- Preview ---
  const openPreview = (a: any) => {
    setPreviewAttachment(a);
    if (isText(a.mime_type)) {
      setTextLoading(true);
      setTextContent(null);
      fetch(attachmentsApi.previewUrl(a.id, token))
        .then((r) => r.text())
        .then((t) => { setTextContent(t); setTextLoading(false); })
        .catch(() => { setTextContent('Failed to load'); setTextLoading(false); });
    }
  };

  const openFile = (a: any) => {
    const url = attachmentsApi.previewUrl(a.id, token);
    Linking.openURL(url);
  };

  const renderBlock = ({ item, index }: { item: Block; index: number }) => {
    if (item.type === 'divider') {
      return <View style={styles.divider} />;
    }
    if (item.type === 'image') {
      return (
        <View style={styles.imageBlock}>
          {item.content ? (
            <Image source={{ uri: item.content }} style={styles.blockImage} resizeMode="contain" />
          ) : (
            <TextInput
              style={styles.imageInput}
              placeholder="Paste image URL..."
              value={item.content || ''}
              onChangeText={(text) => updateBlockContent(index, text)}
              onSubmitEditing={() => handleBlockSubmit(index)}
            />
          )}
        </View>
      );
    }

    const isHeading = item.type === 'heading';
    const isBullet = item.type === 'bullet_list';
    const isTodo = item.type === 'todo';

    return (
      <View style={styles.blockRow}>
        {isBullet && <Text style={styles.bulletMarker}>•</Text>}
        {isTodo && (
          <TouchableOpacity
            style={[
              styles.todoBox,
              blocks[index].checked && styles.todoBoxChecked,
            ]}
            onPress={() => toggleTodoChecked(index)}
            activeOpacity={0.6}
          >
            {blocks[index].checked && <Text style={styles.todoCheckmark}>✓</Text>}
          </TouchableOpacity>
        )}
        <TextInput
          style={[
            styles.blockInput,
            isHeading && styles.headingInput,
            isTodo && blocks[index].checked && styles.todoTextChecked,
          ]}
          value={item.content}
          onChangeText={(text) => updateBlockContent(index, text)}
          onEndEditing={(e: any) => handleBlockBlur(index, e.nativeEvent.text)}
          onSubmitEditing={() => handleBlockSubmit(index)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace') {
              handleBackspace(index);
            }
          }}
          placeholder={isHeading ? 'Heading' : isBullet ? 'List item' : isTodo ? 'Todo' : 'Type something...'}
          multiline
        />
        <TouchableOpacity
          style={styles.typeBtn}
          onPress={() => {
            const typeIdx = BLOCK_TYPES.findIndex((bt) => bt.type === item.type);
            const nextType = BLOCK_TYPES[(typeIdx + 1) % BLOCK_TYPES.length];
            applyBlockType(index, nextType.type);
          }}
        >
          <Text style={styles.typeBtnText}>{BLOCK_TYPES.find((bt) => bt.type === item.type)?.icon || item.type}</Text>
        </TouchableOpacity>

        {/* Slash menu */}
        {slashMenuIndex === index && (
          <View style={styles.slashMenu}>
            {BLOCK_TYPES.map((bt) => (
              <TouchableOpacity
                key={bt.type}
                style={styles.slashMenuItem}
                onPress={() => applyBlockType(index, bt.type)}
              >
                <Text style={styles.slashMenuIcon}>{bt.icon}</Text>
                <Text style={styles.slashMenuLabel}>{bt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.titleRow}>
        {teamId && <View style={styles.teamBadge}><Text style={styles.teamBadgeText}>Team</Text></View>}
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={titleInput}
            onChangeText={setTitleInput}
            onBlur={saveTitle}
            onSubmitEditing={saveTitle}
            autoFocus
            placeholder="Note title"
          />
        ) : (
          <Text style={styles.titleText} onPress={() => { setEditingTitle(true); setTitleInput(title); }}>
            {title || 'Untitled'}
          </Text>
        )}
        <Text style={styles.saveStatus}>{blocks.reduce((s: number, b: Block) => s + b.content.length, 0)} 字 · {titleSaving ? 'Saving...' : saved ? 'Saved' : 'Unsaved'}</Text>
      </View>

      {/* Blocks */}
      <FlatList
        data={blocks}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderBlock}
        contentContainerStyle={styles.blocksList}
      />

      {/* Attachments */}
      <View style={styles.attachmentSection}>
        <View style={styles.attachmentHeader}>
          <Text style={styles.attachmentTitle}>Attachments ({attachments.length})</Text>
          <TouchableOpacity style={styles.attachmentAddBtn} onPress={showUploadOptions} disabled={uploading}>
            <Text style={styles.attachmentAddBtnText}>{uploading ? '...' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>
        {attachments.map((a: any) => (
          <View key={a.id} style={styles.attachmentItem}>
            {isPreviewable(a.mime_type) ? (
              <TouchableOpacity
                style={styles.attachmentNameWrap}
                onPress={() => openPreview(a)}
                activeOpacity={0.7}
              >
                <Text style={styles.attachmentName} numberOfLines={1}>{a.original_name}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.attachmentNameWrap}
                onPress={() => openFile(a)}
                activeOpacity={0.7}
              >
                <Text style={styles.attachmentName} numberOfLines={1}>{a.original_name}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.attachmentSize}>{formatSize(a.size)}</Text>
            <TouchableOpacity style={styles.attachmentDownloadBtn} onPress={() => openFile(a)}>
              <Text style={styles.attachmentDownloadText}>⬇</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachmentDeleteBtn} onPress={() => deleteAttachment(a.id)}>
              <Text style={styles.attachmentDeleteText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Preview overlay */}
      {previewAttachment && (
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseArea} onPress={() => { setPreviewAttachment(null); setTextContent(null); }}>
            <Text style={styles.previewCloseBtn}>×</Text>
          </TouchableOpacity>
          {isImage(previewAttachment.mime_type) && (
            <Image
              source={{ uri: attachmentsApi.previewUrl(previewAttachment.id, token) }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          {isPdf(previewAttachment.mime_type) && (
            <View style={styles.previewPdfContainer}>
              <Text style={styles.previewPdfText}>Tap to open in browser</Text>
              <TouchableOpacity style={styles.previewPdfBtn} onPress={() => openFile(previewAttachment)}>
                <Text style={styles.previewPdfBtnText}>Open PDF</Text>
              </TouchableOpacity>
            </View>
          )}
          {isText(previewAttachment.mime_type) && (
            <View style={styles.previewTextContainer}>
              {textLoading ? (
                <Text style={styles.previewLoadingText}>Loading...</Text>
              ) : (
                <ScrollView style={styles.previewTextScroll}>
                  <Text style={styles.previewText}>{textContent || 'Failed to load'}</Text>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbff', padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 3, borderBottomColor: '#e8e8e8' },
  teamBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#FF3B3B', marginRight: 8, marginTop: 4 },
  teamBadgeText: { fontSize: 9, color: 'white', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  titleText: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  titleInput: { flex: 1, fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', padding: 0 },
  saveStatus: { fontSize: 10, color: '#9b9a97', marginTop: 6, marginLeft: 8 },
  blocksList: { paddingBottom: 20 },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  blockInput: { flex: 1, fontSize: 16, padding: 4, color: '#1a1a2e' },
  headingInput: { fontSize: 20, fontWeight: '600' },
  bulletMarker: { fontSize: 18, marginRight: 8, marginTop: 2, color: '#FF3B3B', fontWeight: 'bold' },
  todoBox: { width: 20, height: 20, borderWidth: 1, borderColor: '#2979FF', borderRadius: 3, marginRight: 8, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  todoBoxChecked: { backgroundColor: '#2979FF', borderColor: '#2979FF' },
  todoCheckmark: { fontSize: 12, color: 'white', fontWeight: 'bold' },
  todoTextChecked: { textDecorationLine: 'line-through', opacity: 0.5 },
  divider: { height: 2, marginVertical: 8, backgroundColor: '#FFC107', opacity: 0.5 },
  typeBtn: { padding: 4, backgroundColor: '#E3F2FD', borderRadius: 4, marginLeft: 4 },
  typeBtnText: { fontSize: 12, color: '#2979FF', fontWeight: '600' },
  slashMenu: { position: 'absolute', bottom: 0, left: 40, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e8e8e8', elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, zIndex: 100, minWidth: 160 },
  slashMenuItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 },
  slashMenuIcon: { fontWeight: '600', width: 24, textAlign: 'center', color: '#2979FF' },
  slashMenuLabel: { fontSize: 14 },
  // Image block
  imageBlock: { paddingVertical: 8 },
  blockImage: { width: '100%', height: 200, borderRadius: 8 },
  imageInput: { fontSize: 14, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 6, color: '#666' },
  // Attachments
  attachmentSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#e8e8e8' },
  attachmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  attachmentTitle: { flex: 1, fontSize: 10, fontWeight: '700', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: 1 },
  attachmentAddBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#FFC107', borderRadius: 4 },
  attachmentAddBtnText: { fontSize: 12, color: 'white', fontWeight: '700' },
  attachmentItem: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 4, backgroundColor: '#FFF8E1', marginBottom: 4 },
  attachmentNameWrap: { flex: 1 },
  attachmentName: { fontSize: 13, color: '#1a1a2e', fontWeight: '500' },
  attachmentSize: { fontSize: 11, color: '#9b9a97', marginRight: 6 },
  attachmentDownloadBtn: { padding: 4 },
  attachmentDownloadText: { fontSize: 16, color: '#2979FF' },
  attachmentDeleteBtn: { padding: 4 },
  attachmentDeleteText: { fontSize: 18, color: '#FF3B3B', fontWeight: '700' },
  // Preview
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseArea: { position: 'absolute', top: 40, right: 16, zIndex: 1001, padding: 8 },
  previewCloseBtn: { fontSize: 32, color: 'white', fontWeight: '700' },
  previewImage: { width: '100%', height: '80%' },
  previewPdfContainer: { alignItems: 'center' },
  previewPdfText: { color: 'white', fontSize: 16, marginBottom: 12 },
  previewPdfBtn: { padding: 12, backgroundColor: '#2979FF', borderRadius: 8 },
  previewPdfBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  previewTextContainer: { width: '90%', maxHeight: '80%' },
  previewTextScroll: { maxHeight: '70%' },
  previewText: { color: '#e0e0e0', fontSize: 14, lineHeight: 22, padding: 16 },
  previewLoadingText: { color: '#999', fontSize: 16 },
});
