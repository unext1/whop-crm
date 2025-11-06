import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';

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

  // Add creation date as the first item if available and it's not already in activities
  if (fallbackCreatedAt) {
    const hasCreationActivity = activities?.some(
      (a) => a.description?.toLowerCase().includes('created') || a.description?.toLowerCase().includes('was created'),
    );
    if (!hasCreationActivity) {
      allItems.push({
        id: 'creation',
        createdAt: fallbackCreatedAt,
        type: 'creation',
      });
    }
  }

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

  // Sort by date (newest first)
  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // If we have items (activities or creation), show them
  if (allItems.length > 0) {
    return (
      <div className="relative">
        <div className="space-y-3">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;

            if (item.type === 'creation') {
              const initial = (fallbackName || fallbackType).charAt(0).toUpperCase();
              const entityType = fallbackType.toLowerCase();

              return (
                <div key={item.id} className="relative flex items-center gap-3 text-sm">
                  {/* Vertical line */}
                  {!isLast && <div className="absolute left-[11px] top-6 bottom-[-12px] w-px bg-border" />}

                  {/* Avatar */}
                  <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {initial}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                    <span className="text-sm text-foreground">
                      <span className="font-medium">You</span>{' '}
                      <span className="text-muted-foreground">created {entityType}</span>
                      {fallbackName && (
                        <>
                          {' '}
                          <span className="font-medium">"{fallbackName}"</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </div>
              );
            }

            const activity = item.activity;
            if (!activity) return null;
            const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;
            const userName = activity.user?.name || 'Unknown User';
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
              <div key={activity.id} className="relative flex items-center gap-3 text-sm">
                {/* Vertical line */}
                {!isLast && <div className="absolute left-[11px] top-6 bottom-[-12px] w-px bg-border" />}

                {/* Avatar */}
                <Avatar className="relative z-10 h-6 w-6 shrink-0">
                  <AvatarImage src={activity.user?.profilePictureUrl || ''} alt={userName} />
                  <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                  <span className="text-sm text-foreground min-w-0">
                    <span className="font-medium">{displayUser}</span>{' '}
                    <span className="text-muted-foreground">{action}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

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
    <div className="relative">
      <div className="space-y-3">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const initial = (fallbackName || fallbackType).charAt(0).toUpperCase();

          return (
            <div key={item.id} className="relative flex items-center gap-3 text-sm">
              {/* Vertical line */}
              {!isLast && <div className="absolute left-[11px] top-6 bottom-[-12px] w-px bg-border" />}

              {/* Avatar */}
              <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {initial}
              </div>

              {/* Content */}
              <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                <span className="text-sm text-foreground">
                  <span className="font-medium">{fallbackName || fallbackType}</span>{' '}
                  <span className="text-muted-foreground">
                    {item.type === 'creation' ? 'was created by' : 'was updated'}
                  </span>
                  {item.type === 'creation' && <span className="font-medium"> You</span>}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(item.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

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
