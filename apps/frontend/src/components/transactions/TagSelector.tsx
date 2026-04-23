'use client';

import { useState } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { useTags, useCreateTag, Tag } from '@/hooks/useTags';

interface TagSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function TagSelector({ selectedIds, onChange }: TagSelectorProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [showCreate, setShowCreate] = useState(false);

  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await createTag.mutateAsync({ name: newName.trim(), color: newColor });
    if (res.success && res.data) {
      onChange([...selectedIds, (res.data as Tag).id]);
    }
    setNewName('');
    setNewColor('#6b7280');
    setShowCreate(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
              style={{
                background: selected ? tag.color + '33' : '#f3f4f6',
                color: selected ? tag.color : '#6b7280',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: selected ? tag.color : 'transparent',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: selected ? tag.color : '#9ca3af' }}
              />
              {tag.name}
              {selected && <X className="h-3 w-3 opacity-60" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-0.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Nova tag
        </button>
      </div>

      {showCreate && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nome da tag"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createTag.isPending}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <TagIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
