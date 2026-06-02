import { useState, useRef, useCallback, useEffect } from 'react';
import { BlockRenderer, BLOCK_TYPES } from './BlockTypes';

function SlashMenu({ position, onSelect, onClose }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => (s + 1) % BLOCK_TYPES.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => (s - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length); }
      else if (e.key === 'Enter') { e.preventDefault(); onSelect(BLOCK_TYPES[selected].type); }
      else if (e.key === 'Escape') { onClose(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selected, onSelect, onClose]);

  return (
    <div className="slash-menu" style={{ top: position.top, left: position.left }}>
      {BLOCK_TYPES.map((bt, i) => (
        <div
          key={bt.type}
          className={`slash-menu-item ${i === selected ? 'active' : ''}`}
          onMouseDown={() => onSelect(bt.type)}
        >
          <span className="slash-menu-icon">{bt.icon}</span>
          <span className="slash-menu-label">{bt.label}</span>
        </div>
      ))}
    </div>
  );
}

function createBlock(type = 'text', content = '', order = 0) {
  return { id: null, type, content, order, parent_block_id: null };
}

export default function BlockEditor({ noteId, teamId, initialBlocks = [], onSaveBlocks }) {
  const [blocks, setBlocks] = useState(
    initialBlocks.length > 0
      ? initialBlocks
      : [createBlock('text', '', 0)]
  );
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [slashMenu, setSlashMenu] = useState(null);
  const saveTimer = useRef(null);
  const blockRefs = useRef([]);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Debounced auto-save — reads from blocksRef to always get latest
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSave = blocksRef.current;
      if (!toSave || toSave.length === 0) return;
      try {
        const blocksPayload = toSave.map((b, i) => ({
          type: b.type,
          content: b.content,
          order: i,
          parentBlockId: b.parent_block_id,
        }));
        if (onSaveBlocks) {
          await onSaveBlocks(blocksPayload);
        } else {
          const resp = await fetch(`/api/notes/${noteId}/blocks`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ blocks: blocksPayload }),
          });
          if (resp.ok) {
            const data = await resp.json();
            // Only merge IDs back — don't change block order
            setBlocks((prev) => {
              if (prev.length !== data.blocks.length) return prev;
              return prev.map((b, i) => ({
                ...b,
                id: data.blocks[i]?.id ?? b.id,
              }));
            });
          }
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 500);
  }, [noteId, onSaveBlocks]);

  // Sync initialBlocks prop changes
  useEffect(() => {
    if (initialBlocks.length > 0) {
      clearTimeout(saveTimer.current);
      setBlocks(initialBlocks);
      setFocusedIndex(0);
    }
  }, [initialBlocks]);

  const triggerSave = useCallback(() => {
    scheduleSave();
  }, [scheduleSave]);

  const updateBlock = (index, updates) => {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    triggerSave();
  };

  const addBlockAfter = (index, type = 'text') => {
    setBlocks((prev) => {
      const next = [...prev];
      const newBlock = createBlock(type, '', 0);
      next.splice(index + 1, 0, newBlock);
      return next;
    });
    setFocusedIndex(index + 1);
    triggerSave();
  };

  const deleteBlock = (index) => {
    setBlocks((prev) => {
      if (prev.length <= 1) {
        setFocusedIndex(0);
        return [createBlock('text', '', 0)];
      }
      setFocusedIndex(Math.max(0, index - 1));
      return prev.filter((_, i) => i !== index);
    });
    triggerSave();
  };

  const handleBlockKeyDown = (index, e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlockAfter(index);
    } else if (e.key === 'Backspace' && blocks[index].content === '') {
      e.preventDefault();
      deleteBlock(index);
    } else if (e.key === 'ArrowUp' && e.target.selectionStart === 0) {
      e.preventDefault();
      setFocusedIndex(Math.max(0, index - 1));
    } else if (e.key === 'ArrowDown') {
      const el = e.target;
      if (e.target.selectionStart === el.innerText?.length || e.target.selectionStart === e.target.value?.length) {
        e.preventDefault();
        setFocusedIndex(Math.min(blocks.length - 1, index + 1));
      }
    } else if (e.key === '/') {
      if (blocks[index].content === '') {
        setTimeout(() => {
          const rect = e.target.getBoundingClientRect();
          setSlashMenu({ blockIndex: index, top: rect.bottom + 4, left: rect.left });
        }, 0);
      }
    }
  };

  const handleSlashSelect = (type) => {
    if (slashMenu) {
      updateBlock(slashMenu.blockIndex, { type, content: '' });
      setSlashMenu(null);
      setFocusedIndex(slashMenu.blockIndex);
    }
  };

  return (
    <div className="block-editor">
      {blocks.map((block, index) => (
        <div key={index} className="block-container">
          <BlockRenderer
            block={block}
            focused={focusedIndex === index}
            onChange={(content) => updateBlock(index, { content })}
            onKeyDown={(e) => handleBlockKeyDown(index, e)}
          />
        </div>
      ))}
      {slashMenu && (
        <SlashMenu
          position={{ top: slashMenu.top, left: slashMenu.left }}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
}
