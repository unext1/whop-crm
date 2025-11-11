import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import type { MeetingType } from '~/db/schema';

type MeetingWithRelations = MeetingType & {
  meetingsPeople?: Array<{ person: { id: string; name: string | null } }>;
  meetingsCompanies?: Array<{ company: { id: string; name: string | null } }>;
};

interface MeetingListProps {
  meetings: Array<
    MeetingWithRelations | { id: string; title: string; startDate: string; duration: number; [key: string]: unknown }
  >;
  onMeetingClick?: (meeting: MeetingWithRelations) => void;
  onEditMeeting?: (meeting: MeetingWithRelations) => void;
  onDeleteMeeting?: (meeting: MeetingWithRelations) => void;
}

// biome-ignore lint/correctness/noUnusedFunctionParameters: <ADDING LATTER>
export function MeetingList({ meetings, onMeetingClick, onEditMeeting, onDeleteMeeting }: MeetingListProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Group meetings by date category
  const groupedMeetings = meetings.reduce(
    (acc, meeting) => {
      const meetingDate = new Date(meeting.startDate);
      const meetingDateOnly = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate());

      let category: 'today' | 'tomorrow' | 'thisWeek' | 'later';
      if (meetingDateOnly.getTime() === today.getTime()) {
        category = 'today';
      } else if (meetingDateOnly.getTime() === tomorrow.getTime()) {
        category = 'tomorrow';
      } else if (meetingDateOnly < nextWeek) {
        category = 'thisWeek';
      } else {
        category = 'later';
      }

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(meeting as MeetingWithRelations);
      return acc;
    },
    {} as Record<'today' | 'tomorrow' | 'thisWeek' | 'later', MeetingWithRelations[]>,
  );

  // Sort meetings within each category by start time
  Object.keys(groupedMeetings).forEach((key) => {
    groupedMeetings[key as keyof typeof groupedMeetings].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  });

  const renderMeetingCard = (meeting: MeetingWithRelations) => {
    const startDate = new Date(meeting.startDate);
    const endDate = new Date(startDate.getTime() + meeting.duration * 60000);

    return (
      <Card
        key={meeting.id}
        className="p-4 bg-muted/30 border-0 shadow-s cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => onMeetingClick?.(meeting)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium truncate">{meeting.title}</h4>
              {meeting.recurrenceType !== 'none' && (
                <Badge variant="outline" className="h-5 text-[10px] px-1.5 capitalize shrink-0">
                  {meeting.recurrenceType}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
                {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            {meeting.location && (
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {meeting.location}
              </p>
            )}
            {meeting.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{meeting.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {meeting.meetingsPeople && meeting.meetingsPeople.length > 0 && (
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                  {meeting.meetingsPeople.length} {meeting.meetingsPeople.length === 1 ? 'person' : 'people'}
                </Badge>
              )}
              {meeting.meetingsCompanies && meeting.meetingsCompanies.length > 0 && (
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                  {meeting.meetingsCompanies.length} {meeting.meetingsCompanies.length === 1 ? 'company' : 'companies'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderSection = (title: string, meetings: MeetingWithRelations[]) => {
    if (meetings.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <div className="space-y-2">{meetings.map(renderMeetingCard)}</div>
      </div>
    );
  };

  const totalMeetings = meetings.length;

  if (totalMeetings === 0) {
    return (
      <div className="rounded-lg border border-border border-dashed flex justify-center items-center flex-col p-8 text-center">
        <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-semibold">No meetings scheduled</p>
        <p className="text-xs text-muted-foreground mt-1">Create a meeting to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection('Today', groupedMeetings.today || [])}
      {renderSection('Tomorrow', groupedMeetings.tomorrow || [])}
      {renderSection('This Week', groupedMeetings.thisWeek || [])}
      {renderSection('Later', groupedMeetings.later || [])}
    </div>
  );
}
