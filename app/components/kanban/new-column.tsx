/* eslint-disable jsx-a11y/no-autofocus */
import { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Form, useSubmit } from 'react-router';
import { CancelButton, SaveButton } from './editible-text';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { PlusIcon } from 'lucide-react';

export function NewColumn({
  projectId,
  onAdd,
  editInitially,
}: {
  projectId: string;
  onAdd: () => void;
  editInitially: boolean;
}) {
  const [editing, setEditing] = useState(editInitially);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();

  return editing ? (
    <Form
      method="post"
      navigate={false}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        submit(formData, {
          navigate: false,
          method: 'post',
          flushSync: true,
        });
        onAdd();
        if (!inputRef.current) throw Error('missing input ref');
        inputRef.current.value = '';
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setEditing(false);
        }
      }}
    >
      <Card className="p-6 shrink-0 flex flex-col gap-4 overflow-hidden max-h-full w-80">
        <input type="hidden" name="intent" value={'createColumn'} />
        <input type="hidden" name="projectId" value={projectId} />
        <Input
          autoFocus
          required
          ref={inputRef}
          type="text"
          name="name"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setEditing(false);
            }
          }}
        />
        <div className="flex justify-between">
          <SaveButton>Save Column</SaveButton>
          <CancelButton onClick={() => setEditing(false)}>Cancel</CancelButton>
        </div>
      </Card>
    </Form>
  ) : (
    <Button
      onClick={() => {
        flushSync(() => {
          setEditing(true);
        });
        onAdd();
      }}
      aria-label="Add new column"
      variant="outline"
      size="default"
      className="py-6"
    >
      <PlusIcon className="w-6" />
    </Button>
  );
}
