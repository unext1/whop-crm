import { CheckSquare, DollarSign, Mail, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFetcher } from 'react-router';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
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
import { Textarea } from './ui/textarea';
import { QuickTodoDialog } from './kanban/quick-todo-dialog';

interface QuickActionsMenuProps {
  type: 'person' | 'company' | 'task';
  entityId: string;
  entityName: string;
  hasWhopId?: boolean;
  primaryEmail?: string | null;
  userId: string;
  organizationId: string;
  onDelete?: () => void;
}

export function QuickActionsMenu({
  type,
  entityId,
  entityName,
  hasWhopId,
  primaryEmail,
  userId,
  onDelete,
}: QuickActionsMenuProps) {
  const [dmOpen, setDmOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
          <Button variant="outline" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-muted/30 backdrop-blur-md border-none shadow-lg">
          <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Send DM - Only for people with Whop ID */}
          {type === 'person' && hasWhopId && (
            <DropdownMenuItem onClick={() => setDmOpen(true)}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Send DM
            </DropdownMenuItem>
          )}

          {/* Send Email */}
          {primaryEmail && (
            <DropdownMenuItem onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </DropdownMenuItem>
          )}

          {/* Create Task */}
          {(type === 'person' || type === 'company') && (
            <DropdownMenuItem onClick={() => setTaskOpen(true)}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Create Task
            </DropdownMenuItem>
          )}

          {/* Create Deal */}
          {type === 'person' && (
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
                  className="text-destructive focus:text-destructive"
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send DM to {entityName}</DialogTitle>
            <DialogDescription>Send a direct message via Whop</DialogDescription>
          </DialogHeader>
          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.append('intent', 'sendDM');
              formData.append('personId', entityId);
              fetcher.submit(formData, { method: 'post' });
              setDmOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="personId" value={entityId} />
            <div className="space-y-2">
              <Label htmlFor="dm-message">Message</Label>
              <Textarea
                id="dm-message"
                name="message"
                placeholder="Type your message..."
                rows={6}
                className="resize-none"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDmOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={fetcher.state === 'submitting'}>
                {fetcher.state === 'submitting' ? 'Sending...' : 'Send DM'}
              </Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      {type === 'person' && (
        <QuickTodoDialog personId={entityId} userId={userId} open={taskOpen} onOpenChange={setTaskOpen} />
      )}

      {type === 'company' && (
        <QuickTodoDialog companyId={entityId} userId={userId} open={taskOpen} onOpenChange={setTaskOpen} />
      )}

      {/* Create Deal Dialog */}
      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Deal for {entityName}</DialogTitle>
            <DialogDescription>Create a new deal in your pipeline</DialogDescription>
          </DialogHeader>
          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.append('intent', 'createDeal');
              formData.append('personId', entityId);
              fetcher.submit(formData, { method: 'post' });
              setDealOpen(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="deal-name">Deal Name</Label>
              <Input
                id="deal-name"
                name="name"
                placeholder={`Deal with ${entityName}`}
                defaultValue={`Deal with ${entityName}`}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-amount">Amount (optional)</Label>
              <Input id="deal-amount" name="amount" type="number" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-content">Notes</Label>
              <Textarea
                id="deal-content"
                name="content"
                placeholder="Add notes about this deal..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDealOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={fetcher.state === 'submitting'}>
                {fetcher.state === 'submitting' ? 'Creating...' : 'Create Deal'}
              </Button>
            </div>
          </fetcher.Form>
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
