import { useState } from 'react';
import { Mail, Plus, X, Star, StarOff } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

interface EmailInput {
  id: string;
  email: string;
  type: 'work' | 'personal' | 'other';
  isPrimary: boolean;
}

interface AddEmailDialogProps {
  trigger: React.ReactNode;
  onAddEmails: (emails: Omit<EmailInput, 'id'>[]) => void;
}

export function AddEmailDialog({ trigger, onAddEmails }: AddEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<EmailInput[]>([
    { id: crypto.randomUUID(), email: '', type: 'work', isPrimary: false },
  ]);

  const addEmail = () => {
    setEmails([...emails, { id: crypto.randomUUID(), email: '', type: 'work', isPrimary: false }]);
  };

  const removeEmail = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter((email) => email.id !== id));
    }
  };

  const updateEmail = (id: string, updates: Partial<EmailInput>) => {
    setEmails(emails.map((email) => (email.id === id ? { ...email, ...updates } : email)));
  };

  const setPrimaryEmail = (id: string) => {
    setEmails(
      emails.map((email) => ({
        ...email,
        isPrimary: email.id === id,
      })),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validEmails = emails.filter((email) => email.email.trim());
    if (validEmails.length > 0) {
      onAddEmails(validEmails.map(({ id, ...email }) => email));
      setOpen(false);
      setEmails([{ id: crypto.randomUUID(), email: '', type: 'work', isPrimary: false }]);
    }
  };

  const hasValidEmails = emails.some((email) => email.email.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s" showCloseButton={false}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <DialogTitle className="text-base font-semibold m-0">Add Email Addresses</DialogTitle>
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
          <form id="add-email-form" onSubmit={handleSubmit} className="space-y-4 p-6">
            {emails.map((email, index) => (
              <div key={email.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Email {index + 1}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryEmail(email.isPrimary ? '' : email.id)}
                      className="h-8 w-8 p-0"
                    >
                      {email.isPrimary ? (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    {emails.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmail(email.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={email.email}
                    onChange={(e) => updateEmail(email.id, { email: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={email.type}
                    onValueChange={(value: 'work' | 'personal' | 'other') => updateEmail(email.id, { type: value })}
                  >
                    <SelectTrigger className="w-30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Work</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  {email.isPrimary && (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      Primary
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-5 text-[10px] capitalize">
                    {email.type}
                  </Badge>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addEmail} className="w-full h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Another Email
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2">{/* Empty space for alignment */}</div>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="add-email-form" size="sm" className="h-8 text-xs" disabled={!hasValidEmails}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Add Emails
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
