import { useState, useEffect, useRef, useCallback } from 'react';
import BlockEditor from './BlockEditor';
import { notes as notesApi, attachments as attachmentsApi, teams as teamsApi } from '../api';

const PREVIEWABLE = {
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'],
  pdf: ['application/pdf'],
  text: ['text/plain', 'text/csv', 'text/html', 'text/xml', 'application/json', 'text/javascript'],
};

function isImage(mime) { return PREVIEWABLE.image.includes(mime); }
function isPdf(mime) { return PREVIEWABLE.pdf.includes(mime); }
function isText(mime) { return PREVIEWABLE.text.includes(mime); }

function PreviewModal({ attachment, onClose }) {
  const [textContent, setTextContent] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isText(attachment.mime_type)) return;
    const controller = new AbortController();
    fetch(attachmentsApi.previewUrl(attachment.id), { signal: controller.signal })
      .then((r) => r.text())
      .then((t) => setTextContent(t))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [attachment]);

  const mime = attachment.mime_type || '';

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-content" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <span className="preview-title">{attachment.original_name}</span>
          <button className="preview-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="preview-body">
          {error && <p style={{ textAlign: 'center', padding: 40, color: '#FF3B3B' }}>Failed to load: {error}</p>}
          {isImage(mime) && (
            <img
              src={attachmentsApi.previewUrl(attachment.id)}
              alt={attachment.original_name}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setError('Failed to load image')}
            />
          )}
          {isImage(mime) && !imgLoaded && !error && (
            <p style={{ textAlign: 'center', padding: 40 }}>Loading...</p>
          )}
          {isPdf(mime) && (
            <iframe
              src={attachmentsApi.previewUrl(attachment.id)}
              style={{ width: '100%', height: '80vh', border: 'none' }}
              title={attachment.original_name}
            />
          )}
          {isText(mime) && textContent !== null && (
            <pre className="preview-text">{textContent}</pre>
          )}
          {isText(mime) && textContent === null && !error && (
            <p style={{ textAlign: 'center', padding: 40 }}>Loading...</p>
          )}
          {!isImage(mime) && !isPdf(mime) && !isText(mime) && (
            <div className="preview-unsupported">
              <p>Preview not available for this file type</p>
              <a href={attachmentsApi.downloadUrl(attachment.id)} className="preview-download-link">
                Download instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentSection({ noteId }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const loadAttachments = useCallback(async () => {
    try {
      const { attachments: a } = await attachmentsApi.list(noteId);
      setAttachments(a);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    }
  }, [noteId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await attachmentsApi.upload(noteId, Array.from(files));
      loadAttachments();
    } catch (err) {
      console.error('Failed to upload:', err);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await attachmentsApi.remove(noteId, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="attachment-section">
      <div className="attachment-header">
        <span className="attachment-title">Attachments ({attachments.length})</span>
        <button
          className="attachment-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : '+ Add'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>
      {attachments.length > 0 && (
        <div className="attachment-list">
          {attachments.map((a) => {
            const previewable = isImage(a.mime_type) || isPdf(a.mime_type) || isText(a.mime_type);
            return (
              <div key={a.id} className="attachment-item">
                {previewable ? (
                  <span
                    className="attachment-name attachment-preview-link"
                    onClick={() => setPreview(a)}
                    style={{ cursor: 'pointer' }}
                  >
                    {a.original_name}
                  </span>
                ) : (
                  <a href={attachmentsApi.downloadUrl(a.id)} className="attachment-name" download>
                    {a.original_name}
                  </a>
                )}
                <span className="attachment-size">{formatSize(a.size)}</span>
                <a
                  href={attachmentsApi.downloadUrl(a.id)}
                  className="attachment-download-btn"
                  download
                  title="Download"
                >
                  &darr;
                </a>
                <button
                  className="attachment-delete-btn"
                  onClick={() => handleDelete(a.id)}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}
      {preview && (
        <PreviewModal attachment={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

export default function NoteEditor({ noteId, teamId }) {
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(true);
  const titleRef = useRef(null);

  const loadNote = useCallback(async () => {
    try {
      const { note: n } = await notesApi.get(noteId);
      setNote(n);
      setTitle(n.title);
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  }, [noteId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleTitleBlur = async () => {
    if (title.trim() && note && title !== note.title) {
      setLoading(true);
      try {
        if (teamId) {
          await teamsApi.update(teamId, noteId, { title: title.trim() });
        } else {
          await notesApi.update(note.id, { title: title.trim() });
        }
        setNote((prev) => (prev ? { ...prev, title: title.trim() } : prev));
        setSaved(true);
      } catch (err) {
        console.error('Failed to update title:', err);
      }
      setLoading(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleBlur();
    }
  };

  const handleSaveBlocks = async (blocks) => {
    if (teamId) {
      await teamsApi.saveBlocks(teamId, noteId, blocks);
    } else {
      await notesApi.saveBlocks(noteId, blocks);
    }
  };

  if (!note) return <div className="note-editor"><p>Loading...</p></div>;

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        {teamId && <span className="team-note-badge">Team</span>}
        <input
          ref={titleRef}
          className="note-title-input"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="Note title"
        />
        <span className="save-status">
          {note.blocks?.reduce((s, b) => s + (b.content || '').length, 0) || 0} 字 · {loading ? 'Saving...' : saved ? 'Saved' : 'Unsaved'}
        </span>
      </div>
      <BlockEditor
        key={note.id}
        noteId={note.id}
        teamId={teamId}
        initialBlocks={note.blocks || []}
        onSaveBlocks={handleSaveBlocks}
      />
      <AttachmentSection noteId={note.id} />
    </div>
  );
}
