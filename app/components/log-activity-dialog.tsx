import { Calendar, CheckCircle2, FileText, Mail, Phone, Users } from 'lucide-react';
import { useState } from 'react';
import { href, useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

interface ActivityType {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const activityTypes: ActivityType[] = [
  {
    value: 'meeting',
    label: 'Meeting',
    icon: Users,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
  },
  {
    value: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  {
    value: 'call',
    label: 'Call',
    icon: Phone,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  {
    value: 'note',
    label: 'Note',
    icon: FileText,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  },
  {
    value: 'task',
    label: 'Task',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
  },
];

interface LogActivityDialogProps {
  entityId: string;
  entityType: string;
  organizationId: string;
  trigger?: React.ReactNode;
}

export function LogActivityDialog({ entityId, entityType, organizationId, trigger }: LogActivityDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const fetcher = useFetcher();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!selectedType) return;

    // Add required fields
    formData.append('entityId', entityId);
    formData.append('entityType', entityType);
    formData.append('activityType', selectedType.value);

    fetcher.submit(formData, {
      method: 'post',
      action: href('/dashboard/:companyId/api/log-activity', { companyId: organizationId }),
      flushSync: true,
    });

    setOpen(false);
    // Reset form
    setSelectedType(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="h-8 text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            Log Activity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Log New Activity</DialogTitle>
          <DialogDescription>Record a new activity for this {entityType.toLowerCase()}.</DialogDescription>
        </DialogHeader>

        <fetcher.Form onSubmit={handleSubmit} className="space-y-6">
          {/* Activity Type Selection */}
          <div className="space-y-3">
            <Label htmlFor="activityType">Activity Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activityTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType?.value === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`p-3 rounded-lg border-2 transition-all hover:border-primary/50 ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`p-2 rounded-full ${type.bgColor} ${type.borderColor} border`}>
                        <Icon className={`h-4 w-4 ${type.color}`} />
                      </div>
                      <span className="text-sm font-medium">{type.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Name */}
          <div className="space-y-2">
            <Label htmlFor="activityName">Activity Name</Label>
            <Input
              id="activityName"
              name="activityName"
              placeholder="e.g., Team meeting, Client call, Project update"
              required
            />
          </div>

          {/* Activity Description */}
          <div className="space-y-2">
            <Label htmlFor="activityDescription">Description (Optional)</Label>
            <Textarea
              id="activityDescription"
              name="activityDescription"
              placeholder="Add any additional details about this activity..."
              rows={3}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activityDate">Date</Label>
              <Input
                id="activityDate"
                name="activityDate"
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activityTime">Time</Label>
              <Input
                id="activityTime"
                name="activityTime"
                type="time"
                defaultValue={new Date().toTimeString().slice(0, 5)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedType || fetcher.state === 'submitting'}>
              {fetcher.state === 'submitting' ? 'Logging...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
