import { useRef, useEffect, useState } from 'react';

function BlockInput({ content, focused, placeholder, onChange, onKeyDown, tag, style }) {
  const ref = useRef(null);
  const lastSaved = useRef(content || '');
  const composing = useRef(false);

  // Sync content when prop changes externally (e.g. from server response)
  useEffect(() => {
    if (!ref.current?.matches(':focus')) {
      ref.current && (ref.current.innerText = content || '');
      lastSaved.current = content || '';
    }
  }, [content]);

  useEffect(() => {
    if (focused && ref.current) ref.current.focus();
  }, [focused]);

  const handleBlur = () => {
    const text = ref.current?.innerText || '';
    if (text !== lastSaved.current) {
      lastSaved.current = text;
      onChange(text);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // During IME composition, let Enter finalize the IME, not add a block
      if (composing.current) return;
      // Save current content before adding new block
      const text = ref.current?.innerText || '';
      if (text !== lastSaved.current) {
        lastSaved.current = text;
        onChange(text);
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleCompositionStart = () => {
    composing.current = true;
  };

  const handleCompositionEnd = () => {
    // Keep flag true briefly so the subsequent Enter keydown still sees it as composing.
    // Reset on next tick so the next Enter (or the one after compositionend) works normally.
    composing.current = true;
    setTimeout(() => { composing.current = false; }, 0);
  };

  const Tag = tag || 'div';

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="block-input"
      data-placeholder={placeholder || 'Type something...'}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      style={style}
    />
  );
}

export function TextBlock({ block, focused, onChange, onKeyDown }) {
  return (
    <BlockInput
      content={block.content}
      focused={focused}
      placeholder="Type something..."
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
}

export function HeadingBlock({ block, focused, onChange, onKeyDown }) {
  return (
    <BlockInput
      content={block.content}
      focused={focused}
      placeholder="Heading"
      onChange={onChange}
      onKeyDown={onKeyDown}
      tag="h2"
      style={{ fontSize: '1.5em', fontWeight: 700, margin: 0 }}
    />
  );
}

export function BulletListBlock({ block, focused, onChange, onKeyDown }) {
  return (
    <div className="block-wrapper bullet-list">
      <span className="bullet-marker">&bull;</span>
      <BlockInput
        content={block.content}
        focused={focused}
        placeholder="List item"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export function TodoBlock({ block, focused, onChange, onKeyDown }) {
  const [checked, setChecked] = useState(false);

  const handleCheckbox = () => {
    setChecked((v) => !v);
  };

  return (
    <div className="block-wrapper todo">
      <input type="checkbox" checked={checked} onChange={handleCheckbox} className="todo-checkbox" />
      <BlockInput
        content={block.content}
        focused={focused}
        placeholder="Todo item"
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.5 : 1 }}
      />
    </div>
  );
}

export function DividerBlock({ block }) {
  return <hr className="block-divider" />;
}

export function ImageBlock({ block, focused, onChange }) {
  return (
    <div className="block-wrapper image">
      {block.content ? (
        <img src={block.content} alt="" className="block-image" />
      ) : (
        <input
          type="text"
          className="image-url-input"
          placeholder="Paste image URL..."
          value={block.content || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

const BLOCK_RENDERERS = {
  text: TextBlock,
  heading: HeadingBlock,
  bullet_list: BulletListBlock,
  todo: TodoBlock,
  divider: DividerBlock,
  image: ImageBlock,
};

export function BlockRenderer({ block, focused, onChange, onKeyDown }) {
  const Renderer = BLOCK_RENDERERS[block.type] || TextBlock;
  return <Renderer block={block} focused={focused} onChange={onChange} onKeyDown={onKeyDown} />;
}

export const BLOCK_TYPES = [
  { type: 'text', label: 'Text', icon: 'Aa' },
  { type: 'heading', label: 'Heading', icon: 'H' },
  { type: 'bullet_list', label: 'Bullet List', icon: '•' },
  { type: 'todo', label: 'Todo', icon: '☐' },
  { type: 'divider', label: 'Divider', icon: '─' },
  { type: 'image', label: 'Image', icon: '\u{1F304}' },
];
