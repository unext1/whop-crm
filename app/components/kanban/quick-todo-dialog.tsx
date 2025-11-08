/* eslint-disable jsx-a11y/no-autofocus */
import { CheckSquare, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Form, useSubmit } from 'react-router';

import { Button } from '../ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface QuickTodoDialogProps {
  companyId?: string;
  personId?: string;
  parentTaskId?: string;
  userId?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickTodoDialog({
  companyId,
  personId,
  parentTaskId,
  userId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: QuickTodoDialogProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
              New Todo
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <CheckSquare className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-base font-semibold m-0">New Todo</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Form Content */}
        <div className="overflow-auto max-h-[calc(100vh-180px)]">
          <Form
            method="post"
            id="quick-todo-form"
            className="space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);

              // Generate temporary ID and timestamp for optimistic UI
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const createdAt = new Date().toISOString();

              formData.set('id', tempId);
              formData.set('createdAt', createdAt);
              formData.set('intent', 'createQuickTodo');

              if (userId) formData.set('ownerId', userId);
              if (companyId) formData.set('relatedCompanyId', companyId);
              if (personId) formData.set('relatedPersonId', personId);
              if (parentTaskId) formData.set('parentTaskId', parentTaskId);

              submit(formData, {
                method: 'post',
                fetcherKey: 'quick-todo',
                navigate: false,
                flushSync: true,
              });

              if (textAreaRef.current) textAreaRef.current.value = '';
              if (inputRef.current) inputRef.current.value = '';

              setOpen(false);
            }}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Todo name <span className="text-muted-foreground">(required)</span>
                </Label>
                <Input
                  autoFocus
                  required
                  ref={inputRef}
                  name="name"
                  placeholder="Enter todo name..."
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  ref={textAreaRef}
                  name="content"
                  placeholder="Add todo details (optional)..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-end gap-2 border-t border-border px-6 bg-muted/30">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="quick-todo-form" size="sm" className="h-8 text-xs">
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
