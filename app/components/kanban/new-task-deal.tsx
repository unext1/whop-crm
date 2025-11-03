import { Building2, DollarSign, User, X } from 'lucide-react';
import { useState } from 'react';
import { Form, useSubmit } from 'react-router';
import { useRef } from 'react';

import { Button } from '../ui/button';
import { CurrencyInput } from '../ui/currency-input';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type Company = {
  id: string;
  name: string | null;
};

type Person = {
  id: string;
  name: string | null;
};

export function NewTaskDeal({
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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs w-full bg-transparent hover:bg-muted/50 border-dashed border border-border"
        >
          + New Deal
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-base font-semibold m-0">
              New Deal {'>'} {columnName}
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
            id="new-task-deal-form"
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
              if (amount > 0) formData.set('amount', amount.toString());

              if (selectedCompanyId) {
                formData.set('relatedCompanyId', selectedCompanyId);
                const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
                if (selectedCompany) {
                  formData.set('companyName', selectedCompany.name || '');
                }
              }
              if (selectedPersonId) {
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

              setSelectedCompanyId('');
              setSelectedPersonId('');
              setAmount(0);
              setOpen(false);
              onAddCard();
              onComplete();
            }}
          >
            <input type="hidden" name="intent" value="createTask" />
            <input type="hidden" name="columnId" value={columnId} />
            <input type="hidden" name="order" value={nextOrder} />

            {/* Main Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Deal name <span className="text-muted-foreground">(required)</span>
                </Label>
                <Input
                  autoFocus
                  required
                  ref={inputRef}
                  name="name"
                  placeholder="Enter deal name..."
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  ref={textAreaRef}
                  name="content"
                  placeholder="Add deal details..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Deal Value</Label>
                <CurrencyInput
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="Enter deal value..."
                  className="h-10"
                />
              </div>
            </div>

            {/* Deal Relations */}
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground">Deal Relations</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Button type="submit" form="new-task-deal-form" size="sm" className="h-8 text-xs">
            Create record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
