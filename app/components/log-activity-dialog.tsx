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
import { DateTimePicker24h } from './ui/calendar-time';

interface ActivityType {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const activityTypesOptions: ActivityType[] = [
  {
    value: 'meeting',
    label: 'Meeting',
    icon: Users,
    color: 'text-purple-500',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  {
    value: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-blue-500',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  {
    value: 'call',
    label: 'Call',
    icon: Phone,
    color: 'text-green-500',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  {
    value: 'note',
    label: 'Note',
    icon: FileText,
    color: 'text-primary',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
  },
  {
    value: 'task',
    label: 'Task',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
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

    // Log the selected time
    const activityDateTime = formData.get('activityDateTime');
    console.log('Activity DateTime:', activityDateTime);

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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activityTypesOptions.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType?.value === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`
                      relative p-4 rounded-xl transition-all duration-300 bg-linear-to-bl from-muted to-muted/30 shadow-s hover:bg-muted cursor-pointer
                      ${isSelected ? 'ring-1 ring-primary' : 'border-transparent hover:border-border/50'}
                    `}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Icon className={`h-5 w-5 ${type.color} ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
                      <span className={`text-xs font-medium ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                        {type.label}
                      </span>
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
          <div className="space-y-2">
            <Label htmlFor="activityDateTime">Date & Time</Label>
            <DateTimePicker24h name="activityDateTime" placeholder="Select date and time" />
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
