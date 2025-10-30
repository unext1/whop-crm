/* eslint-disable jsx-a11y/no-autofocus */
import { Form, useSubmit } from 'react-router';
import { useRef } from 'react';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
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
        <Button variant="secondary" size="sm">
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="text-xs">
            New Task {'>'} {columnName}
          </DialogTitle>
        </DialogHeader>

        <Form
          method="post"
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

          <Input
            autoFocus
            required
            ref={inputRef}
            name="name"
            placeholder="Enter a title for this task..."
            className="bg-transparent text-lg"
          />

          <Textarea
            ref={textAreaRef}
            name="content"
            className="mt-4 bg-transparent"
            placeholder="Enter task content..."
            rows={6}
          />
          <Button size="sm" type="submit" className="mt-2">
            Save Task
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
