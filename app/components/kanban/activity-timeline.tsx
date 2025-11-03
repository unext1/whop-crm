import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Card } from '~/components/ui/card';

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
}

export function ActivityTimeline({
  activities,
  fallbackCreatedAt,
  fallbackUpdatedAt,
  fallbackName,
  fallbackType = 'Item',
  emptyMessage = 'No activity yet',
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
      <div className="space-y-3">
        {allItems.map((item) => {
          if (item.type === 'creation') {
            return (
              <Card key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold shrink-0">
                    {fallbackType.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{fallbackName || fallbackType}</span> was created
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          }

          const activity = item.activity;
          if (!activity) return null;
          const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;
          return (
            <Card key={activity.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={activity.user?.profilePictureUrl || ''} alt="avatar" />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {activity.user?.name ? activity.user.name[0].toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user?.name || 'Unknown User'}</span>{' '}
                    {activity.description || 'performed an action'}
                  </p>
                  {metadata && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {metadata.oldValue && metadata.newValue && (
                        <span className="line-clamp-2 break-words">
                          Changed from{' '}
                          <span className="font-medium inline-block max-w-[200px] truncate align-bottom">
                            {metadata.oldValue}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium inline-block max-w-[200px] truncate align-bottom wrap-break-word">
                            {metadata.newValue}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Fallback to showing created/updated dates if no activities
  const hasDates = fallbackCreatedAt || (fallbackUpdatedAt && fallbackUpdatedAt !== fallbackCreatedAt);

  if (!hasDates) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fallbackCreatedAt && (
        <Card className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
              {fallbackType.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">{fallbackName || fallbackType}</span> was created
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(fallbackCreatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {fallbackUpdatedAt && fallbackUpdatedAt !== fallbackCreatedAt && (
        <Card className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
              {fallbackType.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">{fallbackName || fallbackType}</span> was updated
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(fallbackUpdatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
