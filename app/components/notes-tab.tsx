import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { RichTextEditor } from '~/components/tiptap/rich-text-editor';

interface NotesTabProps {
  initialNotes: string;
  entityType: 'person' | 'company' | 'task';
  entityId: string;
  organizationId: string;
  placeholder?: string;
}

export function NotesTab({ initialNotes, entityType, entityId, organizationId, placeholder }: NotesTabProps) {
  const fetcher = useFetcher();
  const [notes, setNotes] = useState(initialNotes);
  const [lastSavedNotes, setLastSavedNotes] = useState(initialNotes);

  // Update local state when initialNotes changes (e.g., after page refresh)
  useEffect(() => {
    setNotes(initialNotes);
    setLastSavedNotes(initialNotes);
  }, [initialNotes]);

  const hasUnsavedChanges = notes !== lastSavedNotes;
  const isSaving = fetcher.state === 'submitting';
  const isSaved = fetcher.state === 'idle' && !hasUnsavedChanges && fetcher.data?.success;

  const handleSave = () => {
    if (!hasUnsavedChanges || isSaving) return;

    const formData = new FormData();
    formData.set('entityType', entityType);
    formData.set('entityId', entityId);
    formData.set('notes', notes);
    fetcher.submit(formData, {
      method: 'post',
      action: `/dashboard/${organizationId}/api/update-note`,
    });
    setLastSavedNotes(notes);
  };

  const defaultPlaceholder =
    placeholder ||
    (entityType === 'person'
      ? 'Start writing notes about this person...'
      : entityType === 'company'
        ? 'Start writing notes about this company...'
        : 'Start writing notes about this task...');

  return (
    <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-4 flex items-center justify-between min-w-0">
        <h2 className="text-sm font-semibold">Notes</h2>
        <div className="flex items-center gap-2 shrink-0">
          {hasUnsavedChanges && !isSaving && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
          {isSaved && <span className="text-xs text-muted-foreground">Saved</span>}
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
      <RichTextEditor
        value={notes}
        onChange={setNotes}
        placeholder={defaultPlaceholder}
        className="flex-1 rounded-xl max-h-[calc(100dvh-20rem)] min-w-0 max-w-full"
      />
    </div>
  );
}
