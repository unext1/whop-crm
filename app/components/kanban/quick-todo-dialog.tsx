/* eslint-disable jsx-a11y/no-autofocus */
import { Building2, Calendar, CheckSquare, User, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Form, useSubmit } from 'react-router';

import { cn } from '~/utils';
import { Button } from '../ui/button';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { Combobox } from '../ui/combobox';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

type Company = {
  id: string;
  name: string | null;
};

type Person = {
  id: string;
  name: string | null;
};

interface QuickTodoDialogProps {
  companyId?: string;
  personId?: string;
  parentTaskId?: string;
  userId?: string;
  companies?: Company[];
  people?: Person[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickTodoDialog({
  companyId,
  personId,
  parentTaskId,
  userId,
  companies = [],
  people = [],
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: QuickTodoDialogProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const [internalOpen, setInternalOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [selectedRelation, setSelectedRelation] = useState<{
    type: 'company' | 'person';
    id: string;
    name: string;
  } | null>(
    companyId
      ? { type: 'company', id: companyId, name: companies.find((c) => c.id === companyId)?.name || 'Company' }
      : personId
        ? { type: 'person', id: personId, name: people.find((p) => p.id === personId)?.name || 'Person' }
        : null,
  );

  // Prepare grouped items for combobox (companies and people together)
  const relationItems = useMemo(() => {
    const groups: {
      title?: string;
      items: Array<{
        value: string;
        label: string;
        icon: React.ReactElement;
        type: 'company' | 'person';
        id: string;
        onSelect?: () => void;
      }>;
    }[] = [];

    if (companies.length > 0) {
      groups.push({
        title: 'Companies',
        items: companies.map((c) => ({
          value: `company:${c.id}`,
          label: c.name || 'Unnamed Company',
          icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
          type: 'company' as const,
          id: c.id,
          onSelect: () => {
            setSelectedRelation({ type: 'company', id: c.id, name: c.name || 'Unnamed Company' });
          },
        })),
      });
    }

    if (people.length > 0) {
      groups.push({
        title: 'People',
        items: people.map((p) => ({
          value: `person:${p.id}`,
          label: p.name || 'Unnamed Person',
          icon: <User className="h-4 w-4 text-muted-foreground" />,
          type: 'person' as const,
          id: p.id,
          onSelect: () => {
            setSelectedRelation({ type: 'person', id: p.id, name: p.name || 'Unnamed Person' });
          },
        })),
      });
    }

    return groups;
  }, [companies, people]);

  // Get selected item for combobox
  const selectedRelationItem = useMemo(() => {
    if (!selectedRelation) return undefined;
    return {
      value: `${selectedRelation.type}:${selectedRelation.id}`,
      label: selectedRelation.name,
      icon: selectedRelation.type === 'company' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />,
      type: selectedRelation.type,
      id: selectedRelation.id,
    };
  }, [selectedRelation]);

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

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
        className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
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
            className="space-y-6 p-6"
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
              if (parentTaskId) formData.set('parentTaskId', parentTaskId);

              if (dueDate) {
                formData.set('dueDate', formatDate(dueDate));
              }

              const priority = formData.get('priority');
              if (priority) {
                formData.set('priority', String(priority));
              }

              // Handle relations - prefer explicit selection over pre-filled props
              if (selectedRelation) {
                if (selectedRelation.type === 'company') {
                  formData.set('relatedCompanyId', selectedRelation.id);
                  formData.set('companyName', selectedRelation.name);
                } else {
                  formData.set('relatedPersonId', selectedRelation.id);
                  formData.set('personName', selectedRelation.name);
                }
              } else {
                // Fallback to props if no explicit selection
                if (companyId) {
                  formData.set('relatedCompanyId', companyId);
                }
                if (personId) {
                  formData.set('relatedPersonId', personId);
                }
              }

              submit(formData, {
                method: 'post',
                fetcherKey: 'quick-todo',
                navigate: false,
                flushSync: true,
              });

              if (textAreaRef.current) textAreaRef.current.value = '';
              if (inputRef.current) inputRef.current.value = '';

              setDueDate(undefined);
              setSelectedRelation(
                companyId
                  ? {
                      type: 'company',
                      id: companyId,
                      name: companies.find((c) => c.id === companyId)?.name || 'Company',
                    }
                  : personId
                    ? { type: 'person', id: personId, name: people.find((p) => p.id === personId)?.name || 'Person' }
                    : null,
              );

              if (!createMore) {
                setOpen(false);
              }
            }}
          >
            {/* Main Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="space-y-2 col-span-3">
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

                <div className="space-y-2 col-span-2">
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select name="priority">
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select priority..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>Low</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span>Medium</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span>High</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  ref={textAreaRef}
                  name="content"
                  placeholder="Add todo details..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Configuration Section */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'h-10 w-full justify-start text-left font-normal',
                          !dueDate && 'text-muted-foreground',
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dueDate ? formatDate(dueDate) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={dueDate} onSelect={setDueDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Relations Section */}
            {(companies.length > 0 || people.length > 0) && (
              <div className="space-y-4 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">Relations</h3>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Link to
                  </Label>
                  <Combobox
                    key={selectedRelation ? `${selectedRelation.type}:${selectedRelation.id}` : 'none'}
                    groupedItems={relationItems}
                    selectedItem={selectedRelationItem}
                    buttonTrigger={(item) => (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'h-10 w-full justify-start text-left font-normal',
                          !item && 'text-muted-foreground',
                        )}
                      >
                        {item ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                          </div>
                        ) : (
                          <span>Select company or person...</span>
                        )}
                      </Button>
                    )}
                    labels={{
                      inputLabel: 'Search companies and people...',
                      notFoundLabel: 'No companies or people found.',
                    }}
                  />
                </div>
              </div>
            )}
          </Form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2">
            <Switch id="create-more" checked={createMore} onCheckedChange={setCreateMore} />
            <Label htmlFor="create-more" className="text-sm font-normal cursor-pointer">
              Create more
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="quick-todo-form" size="sm" className="h-8 text-xs">
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
