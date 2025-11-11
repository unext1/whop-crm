/* eslint-disable jsx-a11y/no-autofocus */
import { Building2, CableIcon, Calendar, CheckSquare, User, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Form, useSubmit } from 'react-router';

import { cn } from '~/utils';
import { Button } from '../ui/button';
import { Calendar as CalendarComponent } from '../ui/calendar';
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

export function NewTaskTodo({
  columnId,
  nextOrder,
  columnName,
  onComplete,
  onAddCard,
  companies = [],
  people = [],
  boardId,
  userId,
}: {
  columnId: string;
  nextOrder: number;
  columnName: string;
  onComplete: () => void;
  onAddCard: () => void;
  companies?: Company[];
  people?: Person[];
  boardId?: string;
  userId?: string;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [selectedRelationType, setSelectedRelationType] = useState<'none' | 'company' | 'person'>('none');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [createMore, setCreateMore] = useState(false);

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 cursor-pointer text-xs w-full bg-transparent hover:bg-muted/50 border-dashed border border-border"
        >
          + New Task
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg shadow-s"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <CheckSquare className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-base font-semibold m-0">
              New Task {'>'} {columnName}
            </DialogTitle>
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
            id="new-task-todo-form"
            className="space-y-6 p-6"
            onSubmit={(event) => {
              event.preventDefault();

              const formData = new FormData(event.currentTarget);

              // Generate temporary ID and timestamp for optimistic UI
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const createdAt = new Date().toISOString();

              formData.set('id', tempId);
              formData.set('createdAt', createdAt);
              if (boardId) formData.set('boardId', boardId);
              if (userId) formData.set('ownerId', userId);

              if (dueDate) {
                formData.set('dueDate', formatDate(dueDate));
              }

              const priority = formData.get('priority');
              if (priority) {
                formData.set('priority', String(priority));
              }

              if (selectedRelationType === 'company' && selectedCompanyId) {
                formData.set('relatedCompanyId', selectedCompanyId);
                const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
                if (selectedCompany) {
                  formData.set('companyName', selectedCompany.name || '');
                }
              }
              if (selectedRelationType === 'person' && selectedPersonId) {
                formData.set('relatedPersonId', selectedPersonId);
                const selectedPerson = people.find((p) => p.id === selectedPersonId);
                if (selectedPerson) {
                  formData.set('personName', selectedPerson.name || '');
                }
              }

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

              setDueDate(undefined);
              setSelectedRelationType('none');
              setSelectedCompanyId('');
              setSelectedPersonId('');
              if (!createMore) {
                setOpen(false);
              }
              onAddCard();
              onComplete();
            }}
          >
            <input type="hidden" name="intent" value="createTask" />
            <input type="hidden" name="columnId" value={columnId} />
            <input type="hidden" name="order" value={nextOrder} />

            {/* Main Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label className="text-sm font-medium">
                    Task name <span className="text-muted-foreground">(required)</span>
                  </Label>
                  <Input autoFocus required ref={inputRef} name="name" placeholder="Enter task name..." />
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
                  placeholder="Add task details..."
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
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Relations</h3>

              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CableIcon className="h-4 w-4 text-muted-foreground" />
                    Link to
                  </Label>
                  <Select
                    value={selectedRelationType}
                    onValueChange={(value: 'none' | 'company' | 'person') => {
                      setSelectedRelationType(value);
                      if (value !== 'company') setSelectedCompanyId('');
                      if (value !== 'person') setSelectedPersonId('');
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select relation..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No relation</SelectItem>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>Company</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="person">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Person</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Company Selection - Animated in */}
                {selectedRelationType === 'company' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Company
                    </Label>
                    {companies.length > 0 ? (
                      <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select company..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                                  <Building2 className="h-3 w-3 text-primary" />
                                </div>
                                <span>{company.name || 'Unnamed Company'}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex h-10 items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30">
                        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        No companies available
                      </div>
                    )}
                  </div>
                )}

                {/* Person Selection - Animated in */}
                {selectedRelationType === 'person' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Person
                    </Label>
                    {people.length > 0 ? (
                      <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select person..." />
                        </SelectTrigger>
                        <SelectContent>
                          {people.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                                  <User className="h-3 w-3 text-primary" />
                                </div>
                                <span>{person.name || 'Unnamed Person'}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex h-10 items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        No people available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-between gap-2 border-t border-border px-6 bg-muted/30">
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
            <Button type="submit" form="new-task-todo-form" size="sm" className="h-8 text-xs">
              Create record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
