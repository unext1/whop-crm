/* eslint-disable jsx-a11y/no-autofocus */
import { Form, useSubmit } from 'react-router';
import { useRef } from 'react';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export function NewTask({
  columnId,
  nextOrder,
  columnName,
  onComplete,
  onAddCard,
}: {
  columnId: string;
  nextOrder: number;
  columnName: string;
  onComplete: () => void;
  onAddCard: () => void;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useSubmit();

  // const dt = new Date();
  // const padL = (nr: number, chr = '0') => `${nr}`.padStart(2, chr);

  // const createdAt = `${dt.getFullYear()}-${padL(dt.getMonth() + 1)}-${padL(dt.getDate())} ${padL(dt.getHours())}:${padL(
  //   dt.getMinutes()
  // )}:${padL(dt.getSeconds())}`;
  // console.log(createdAt);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs w-full bg-transparent hover:bg-muted/50 border-dashed border border-border"
        >
          + New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-6 bg-muted/40">
          <DialogTitle className="text-sm font-semibold m-0">
            New Task {'>'} {columnName}
          </DialogTitle>
        </div>

        {/* Form Content */}
        <div className="overflow-auto max-h-[calc(100vh-180px)]">
          <Form
            method="post"
            id="new-task-form"
            className="p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);

              submit(formData, {
                method: 'post',
                fetcherKey: 'task',
                navigate: false,
                flushSync: true,
              });

              if (!textAreaRef.current) throw Error('No Text Area');
              textAreaRef.current.value = '';

              if (!inputRef.current) throw Error('No title');
              inputRef.current.value = '';

              onAddCard();
              onComplete();
              inputRef.current.focus();
            }}
          >
            <input type="hidden" name="intent" value="createTask" />
            <input type="hidden" name="columnId" value={columnId} />
            <input type="hidden" name="order" value={nextOrder} />

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Task name <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input
                autoFocus
                required
                ref={inputRef}
                name="name"
                placeholder="Set Task name..."
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Content</Label>
              <Textarea
                ref={textAreaRef}
                name="content"
                placeholder="Set Content..."
                rows={6}
                className="text-sm resize-none"
              />
            </div>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-end gap-2 border-t border-border px-6 bg-muted/40">
          <Button type="submit" form="new-task-form" size="sm" className="h-8 text-xs">
            Create record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
