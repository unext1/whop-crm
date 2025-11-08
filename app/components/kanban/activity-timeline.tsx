import { CheckCircle2, ChevronRight, FileText, Mail, Phone, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '../ui/badge';

interface ActivityItem {
  id: string;
  createdAt: string;
  description?: string | null;
  metadata?: string | null;
  user?: {
    id: string;
    name: string | null;
    profilePictureUrl?: string | null;
  } | null;
}

interface ActivityTimelineProps {
  activities?: ActivityItem[];
  fallbackCreatedAt?: string | null;
  fallbackUpdatedAt?: string | null;
  fallbackName?: string | null;
  fallbackType?: string; // 'Task', 'Person', 'Company', etc.
  emptyMessage?: string;
  onViewAll?: () => void;
  showViewAll?: boolean;
}

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

function formatRelativeTime(date: string): string {
  // Ensure proper date parsing - if date doesn't have timezone info, treat as UTC
  let then: Date;
  // Check if date has timezone info (Z for UTC, or +/-HH:MM pattern)
  const hasTimezone = date.includes('Z') || /[+-]\d{2}:\d{2}$/.test(date);
  if (hasTimezone) {
    // Date has timezone info, parse normally
    then = new Date(date);
  } else {
    // Date doesn't have timezone info, assume UTC and append 'Z'
    then = new Date(date.endsWith('Z') ? date : `${date}Z`);
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  // Handle negative differences (future dates) by showing "Now"
  if (diffInSeconds < 0) {
    return 'Now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);

  // Show "Now" for anything less than 5 minutes
  if (diffInMinutes < 5) {
    return 'Now';
  }

  // Show minutes for 5-59 minutes
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
}

function formatActivityDescription(
  description: string,
  userName?: string | null,
  metadata?: { oldValue?: string; newValue?: string; field?: string } | null,
): string {
  const user = userName || 'Unknown User';
  const desc = description.trim();

  // Handle "You" descriptions - convert to use actual user name
  if (desc.includes('You')) {
    return desc.replace(/You/g, user);
  }

  // Pattern: "Task 'name' was created" → "{user} created task 'name'"
  const createdMatch = desc.match(/^(Task|task)\s+["']([^"']+)["']\s+was\s+created$/i);
  if (createdMatch) {
    return `${user} created task "${createdMatch[2]}"`;
  }

  // Pattern: "X was created" → "{user} created X"
  if (desc.toLowerCase().includes('was created')) {
    const match = desc.match(/^(.+?)\s+was\s+created$/i);
    if (match) {
      return `${user} created ${match[1].toLowerCase()}`;
    }
  }

  // Pattern: "Moved from X to Y" → "{user} moved from X to Y"
  if (desc.toLowerCase().includes('moved from')) {
    return `${user} ${desc.toLowerCase()}`;
  }

  // Pattern: "X changed to Y" → "{user} changed X to Y"
  const changedToMatch = desc.match(/^(.+?)\s+changed\s+to\s+(.+)$/i);
  if (changedToMatch) {
    return `${user} changed ${changedToMatch[1].toLowerCase()} to ${changedToMatch[2]}`;
  }

  // Pattern: "X changed from Y to Z" → "{user} changed X from Y to Z"
  const changedFromMatch = desc.match(/^(.+?)\s+changed\s+from\s+(.+?)\s+to\s+(.+)$/i);
  if (changedFromMatch) {
    return `${user} changed ${changedFromMatch[1].toLowerCase()} from ${changedFromMatch[2]} to ${changedFromMatch[3]}`;
  }

  // Pattern: "X added" or "added X" → "{user} added X"
  const addedMatch = desc.match(/^(.+?)\s+added$/i) || desc.match(/^added\s+(.+)$/i);
  if (addedMatch) {
    const item = addedMatch[1] || addedMatch[2];
    return `${user} added ${item.toLowerCase()}`;
  }

  // Pattern: "comment added" → "{user} added comment"
  if (desc.toLowerCase().includes('added')) {
    const match = desc.match(/^(.+?)\s+added$/i);
    if (match) {
      return `${user} added ${match[1].toLowerCase()}`;
    }
  }

  // Handle metadata-based changes
  if (metadata) {
    if (metadata.field && metadata.oldValue && metadata.newValue) {
      return `${user} changed ${metadata.field.toLowerCase()} from ${metadata.oldValue} to ${metadata.newValue}`;
    }
    if (metadata.field && metadata.newValue) {
      return `${user} changed ${metadata.field.toLowerCase()} to ${metadata.newValue}`;
    }
    if (metadata.oldValue && metadata.newValue) {
      return `${user} moved from ${metadata.oldValue} to ${metadata.newValue}`;
    }
  }

  // Default: prepend user name if not already present
  if (!desc.toLowerCase().startsWith(user.toLowerCase())) {
    return `${user} ${desc.toLowerCase()}`;
  }

  return desc;
}

export function ActivityTimeline({
  activities,
  fallbackCreatedAt,
  fallbackUpdatedAt,
  fallbackName,
  fallbackType = 'Item',
  emptyMessage = 'No activity yet',
  onViewAll,
  showViewAll = false,
}: ActivityTimelineProps) {
  // Combine activities with creation date if available
  const allItems: Array<{ id: string; createdAt: string; type: 'activity' | 'creation'; activity?: ActivityItem }> = [];

  // Add all activities
  if (activities && activities.length > 0) {
    activities.forEach((activity) => {
      allItems.push({
        id: activity.id,
        createdAt: activity.createdAt,
        type: 'activity',
        activity,
      });
    });
  }

  // Add creation date as the last item only if there are no activities at all
  if (allItems.length === 0 && fallbackCreatedAt) {
    allItems.push({
      id: 'creation',
      createdAt: fallbackCreatedAt,
      type: 'creation',
    });
  }

  // Sort by date (newest first) - handle dates with/without timezone info like formatRelativeTime
  allItems.sort((a, b) => {
    const parseDate = (date: string) => {
      // Check if date has timezone info (Z for UTC, or +/-HH:MM pattern)
      const hasTimezone = date.includes('Z') || /[+-]\d{2}:\d{2}$/.test(date);
      if (hasTimezone) {
        // Date has timezone info, parse normally
        return new Date(date);
      }
      // Date doesn't have timezone info, assume UTC and append 'Z'
      return new Date(date.endsWith('Z') ? date : `${date}Z`);
    };

    const dateA = parseDate(a.createdAt);
    const dateB = parseDate(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  // If we have items (activities or creation), show them
  if (allItems.length > 0) {
    return (
      <div className="relative space-y-0">
        <div className="absolute left-4 top-6 bottom-6 w-px bg-border" />
        {allItems.map((item) => {
          if (item.type === 'creation') {
            const initial = (fallbackName || fallbackType).charAt(0).toUpperCase();
            const entityType = fallbackType.toLowerCase();

            return (
              <div key={item.id} className="relative">
                <div className="flex gap-4 py-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-background">
                    {initial}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">You</span>
                          <span className="text-muted-foreground"> created {entityType}</span>
                          {fallbackName && (
                            <>
                              <span className="text-muted-foreground"> </span>
                              <span className="font-semibold text-foreground">"{fallbackName}"</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          }

          const activity = item.activity;
          if (!activity) return null;
          const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;
          const userName = activity.user?.name || 'Unknown User';

          // Check if this is a manually logged activity (has metadata with name, description, type)
          const isManualActivity = metadata && metadata.name && metadata.type;
          const activityType = isManualActivity
            ? activityTypes.find((type) => type.value === (metadata as { type: string }).type)
            : null;

          if (isManualActivity && activityType) {
            // Render manual activity in slick timeline format
            const Icon = activityType.icon;

            return (
              <div key={activity.id} className="relative">
                <div className="flex gap-4 py-4">
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activityType.bgColor} text-sm font-semibold ${activityType.color} ring-4 ring-background`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {/* Main Activity */}
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">{userName}</span>
                          <span className="text-muted-foreground"> logged {activityType.label.toLowerCase()}</span>
                          <span className="text-muted-foreground"> </span>
                          <span className="font-semibold text-foreground">"{metadata.name}"</span>
                        </p>
                      </div>

                      {/* Activity Details */}
                      <div className="mt-3 rounded-xl duration-300 shadow-s bg-linear-to-bl from-muted to-muted/30 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-full w-1 bg-primary rounded" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{metadata.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatRelativeTime(activity.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={`${activityType.bgColor} ${activityType.color} ${activityType.borderColor} border`}
                                >
                                  {activityType.label}
                                </Badge>
                              </div>
                            </div>
                            {metadata.description && (
                              <p className="text-sm text-muted-foreground">{metadata.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Render system activity in slick timeline format
          const userInitial = userName.charAt(0).toUpperCase();

          // Format the activity description
          const formattedDescription = activity.description
            ? formatActivityDescription(activity.description, userName, metadata)
            : `${userName} performed an action`;

          // Parse the formatted description to extract user name and action parts for styling
          const parts = formattedDescription.split(/\s+(.+)/);
          const displayUser = parts[0] || userName;
          const action = parts[1] || 'performed an action';

          return (
            <div key={activity.id} className="relative">
              <div className="flex gap-4 py-4">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-background">
                  {activity.user?.profilePictureUrl ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activity.user.profilePictureUrl} alt={userName} />
                      <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Main Activity */}
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">{displayUser}</span>
                        <span className="text-muted-foreground"> {action}</span>
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(activity.createdAt)}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* View all link */}
        {showViewAll && onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="mt-4 flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Fallback to showing created/updated dates if no activities
  const hasDates = fallbackCreatedAt || (fallbackUpdatedAt && fallbackUpdatedAt !== fallbackCreatedAt);

  if (!hasDates) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const items = [];
  if (fallbackCreatedAt) {
    items.push({ id: 'creation', createdAt: fallbackCreatedAt, type: 'creation' as const });
  }
  if (fallbackUpdatedAt && fallbackUpdatedAt !== fallbackCreatedAt) {
    items.push({ id: 'update', createdAt: fallbackUpdatedAt, type: 'update' as const });
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-4 top-6 bottom-0 w-px bg-border" />
      {items.map((item) => {
        const initial = (fallbackName || fallbackType).charAt(0).toUpperCase();

        return (
          <div key={item.id} className="relative">
            <div className="flex gap-4 py-4">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-background">
                {initial}
              </div>
              <div className="flex flex-1 items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">{fallbackName || fallbackType}</span>
                      <span className="text-muted-foreground">
                        {item.type === 'creation' ? ' was created by' : ' was updated'}
                      </span>
                      {item.type === 'creation' && <span className="font-semibold text-foreground"> You</span>}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* View all link */}
      {showViewAll && onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-4 flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
