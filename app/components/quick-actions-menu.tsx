import { CheckSquare, DollarSign, Mail, MoreHorizontal, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useFetcher } from 'react-router';
import { QuickTodoDialog } from './kanban/quick-todo-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { CurrencyInput } from './ui/currency-input';
import { Dialog, DialogClose, DialogContent, DialogTitle } from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';

interface QuickActionsMenuProps {
  type: 'person' | 'company' | 'task';
  entityId: string;
  entityName: string;
  hasWhopId?: boolean;
  primaryEmail?: string | null;
  userId: string;
  organizationId: string;
  onDelete?: () => void;
  companies?: Array<{ id: string; name: string | null }>;
  people?: Array<{ id: string; name: string | null }>;
  parentTaskId?: string;
}

export function QuickActionsMenu({
  type,
  entityId,
  entityName,
  hasWhopId: _hasWhopId,
  primaryEmail,
  userId,
  onDelete,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: adding later
  companies = [],
  // biome-ignore lint/correctness/noUnusedFunctionParameters: adding later
  people = [],
  parentTaskId,
}: QuickActionsMenuProps) {
  const [dmOpen, setDmOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const fetcher = useFetcher();

  const handleSendEmail = () => {
    if (primaryEmail) {
      window.location.href = `mailto:${primaryEmail}`;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8 border-0 shadow-s">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>

          {/* Send DM - Only for people with Whop ID */}
          {/* {type === 'person' && hasWhopId && (
            <DropdownMenuItem onClick={() => setDmOpen(true)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Send DM
            </DropdownMenuItem>
          )} */}

          {/* Send Email */}
          {primaryEmail && (
            <DropdownMenuItem onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </DropdownMenuItem>
          )}

          {/* Create Task */}
          {(type === 'person' || type === 'company' || (type === 'task' && parentTaskId)) && (
            <DropdownMenuItem onClick={() => setTaskOpen(true)}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Create Task
            </DropdownMenuItem>
          )}

          {/* Create Deal */}
          {(type === 'person' || type === 'company') && (
            <DropdownMenuItem onClick={() => setDealOpen(true)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Create Deal
            </DropdownMenuItem>
          )}

          {/* Delete */}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Send DM Dialog */}
      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent
          className="sm:max-w-[625px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-lg"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                <Mail className="h-3.5 w-3.5" />
              </div>
              <DialogTitle className="text-base font-semibold m-0">Send DM to {entityName}</DialogTitle>
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
            <fetcher.Form
              method="post"
              id="send-dm-form"
              className="space-y-6 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                formData.append('intent', 'sendDM');
                formData.append('personId', entityId);
                fetcher.submit(formData, { method: 'post' });
                setDmOpen(false);
              }}
            >
              <input type="hidden" name="personId" value={entityId} />
              <div className="space-y-2">
                <Label htmlFor="dm-message" className="text-sm font-medium">
                  Message <span className="text-muted-foreground">(required)</span>
                </Label>
                <Textarea
                  id="dm-message"
                  name="message"
                  placeholder="Type your message..."
                  rows={6}
                  className="resize-none"
                  required
                />
              </div>
            </fetcher.Form>
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
              <Button type="submit" form="send-dm-form" size="sm" className="h-8 text-xs">
                {fetcher.state === 'submitting' ? 'Sending...' : 'Send DM'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      {type === 'person' && (
        <QuickTodoDialog
          personId={entityId}
          userId={userId}
          companies={[]}
          people={[]}
          open={taskOpen}
          onOpenChange={setTaskOpen}
        />
      )}

      {type === 'company' && (
        <QuickTodoDialog
          companyId={entityId}
          userId={userId}
          companies={[]}
          people={[]}
          open={taskOpen}
          onOpenChange={setTaskOpen}
        />
      )}

      {/* Create Todo Dialog for Tasks/Deals */}
      {type === 'task' && parentTaskId && (
        <QuickTodoDialog
          parentTaskId={parentTaskId}
          userId={userId}
          companies={[]}
          people={[]}
          open={taskOpen}
          onOpenChange={setTaskOpen}
        />
      )}

      {/* Create Deal Dialog */}
      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
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
                New Deal {'>'} {entityName}
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
            <fetcher.Form
              method="post"
              id="create-deal-form"
              className="space-y-6 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                formData.append('intent', 'createDeal');
                if (type === 'person') {
                  formData.append('personId', entityId);
                } else if (type === 'company') {
                  formData.append('companyId', entityId);
                }
                if (amount > 0) {
                  formData.append('amount', amount.toString());
                }
                fetcher.submit(formData, { method: 'post' });
                if (!createMore) {
                  setDealOpen(false);
                }
                setAmount(0);
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deal-name" className="text-sm font-medium">
                    Deal name <span className="text-muted-foreground">(required)</span>
                  </Label>
                  <Input
                    id="deal-name"
                    name="name"
                    placeholder={`Deal with ${entityName}`}
                    defaultValue={`Deal with ${entityName}`}
                    className="h-10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="deal-content"
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
            </fetcher.Form>
          </div>

          {/* Footer */}
          <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch id="create-more-deal" checked={createMore} onCheckedChange={setCreateMore} />
              <Label htmlFor="create-more-deal" className="text-sm font-normal cursor-pointer">
                Create more
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="create-deal-form" size="sm" className="h-8 text-xs">
                {fetcher.state === 'submitting' ? 'Creating...' : 'Create record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {type === 'person' ? 'Person' : type === 'company' ? 'Company' : 'Task'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {entityName}? This action cannot be undone and will permanently remove
              this {type === 'person' ? 'person' : type === 'company' ? 'company' : 'task'} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDeleteOpen(false);
                onDelete?.();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
