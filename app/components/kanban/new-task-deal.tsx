import { Building2, DollarSign, User, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Form, useSubmit } from 'react-router';
import { useRef } from 'react';

import { cn } from '~/utils';
import { Button } from '../ui/button';
import { Combobox } from '../ui/combobox';
import { CurrencyInput } from '../ui/currency-input';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
  const [selectedRelation, setSelectedRelation] = useState<{
    type: 'company' | 'person';
    id: string;
    name: string;
  } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [createMore, setCreateMore] = useState(false);

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

              if (selectedRelation) {
                if (selectedRelation.type === 'company') {
                  formData.set('relatedCompanyId', selectedRelation.id);
                  formData.set('companyName', selectedRelation.name);
                } else {
                  formData.set('relatedPersonId', selectedRelation.id);
                  formData.set('personName', selectedRelation.name);
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

              setSelectedRelation(null);
              setAmount(0);
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

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Link to
                </Label>
                {companies.length > 0 || people.length > 0 ? (
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
                ) : (
                  <div className="flex h-10 items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    No companies or people available
                  </div>
                )}
              </div>
            </div>
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
            <Button type="submit" form="new-task-deal-form" size="sm" className="h-8 text-xs">
              Create record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
