import { Building2, Calendar, Clock, MapPin, Repeat, User, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import type { MeetingType } from '~/db/schema';

type MeetingWithRelations = MeetingType & {
  meetingsPeople?: Array<{ person: { id: string; name: string | null } }>;
  meetingsCompanies?: Array<{ company: { id: string; name: string | null } }>;
};

interface MeetingDetailSheetProps {
  meeting: MeetingWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (meeting: MeetingWithRelations) => void;
  onDelete?: (meeting: MeetingWithRelations) => void;
}

export function MeetingDetailSheet({ meeting, open, onOpenChange, onEdit, onDelete }: MeetingDetailSheetProps) {
  if (!meeting) return null;

  const startDate = new Date(meeting.startDate);
  const endDate = new Date(startDate.getTime() + meeting.duration * 60000);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{meeting.title}</SheetTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">
                  {startDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Time</p>
                <p className="font-medium">
                  {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
                  {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
            {meeting.recurrenceType !== 'none' && (
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground">Recurrence</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{meeting.recurrenceType}</p>
                    {meeting.recurrenceEndDate && (
                      <span className="text-xs text-muted-foreground">
                        until {new Date(meeting.recurrenceEndDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Location */}
          {meeting.location && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{meeting.location}</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Description */}
          {meeting.description && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Attendees */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Attendees</p>
            {meeting.meetingsPeople && meeting.meetingsPeople.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="font-medium">People</span>
                </div>
                <div className="space-y-2 pl-6">
                  {meeting.meetingsPeople.map(({ person }) => (
                    <div key={person.id} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {person.name?.charAt(0) || 'P'}
                      </div>
                      <span className="text-sm">{person.name || 'Unnamed Person'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {meeting.meetingsCompanies && meeting.meetingsCompanies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="font-medium">Companies</span>
                </div>
                <div className="space-y-2 pl-6">
                  {meeting.meetingsCompanies.map(({ company }) => (
                    <div key={company.id} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {company.name?.charAt(0) || 'C'}
                      </div>
                      <span className="text-sm">{company.name || 'Unnamed Company'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(!meeting.meetingsPeople || meeting.meetingsPeople.length === 0) &&
              (!meeting.meetingsCompanies || meeting.meetingsCompanies.length === 0) && (
                <p className="text-sm text-muted-foreground">No attendees</p>
              )}
          </div>

          {/* Notes */}
          {meeting.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(meeting)} className="flex-1">
                Edit Meeting
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
                    onDelete(meeting);
                    onOpenChange(false);
                  }
                }}
                className="flex-1"
              >
                Delete Meeting
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
