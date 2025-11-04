import { AlertCircle, Building2, Calendar, Circle, Clock, MessageCircle, RotateCcw, User, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams, useSubmit } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { TaskType } from './column';

const TaskTodo = ({
  name,
  content,
  id,
  order,
  columnId,
  createdAt,
  previousOrder,
  ownerId,
  owner,
  nextOrder,
  assignees,
  dueDate,
  priority,
  company,
  person,
  commentsCount = 0,
}: TaskType & {
  previousOrder: number;
  nextOrder: number;
  dueDate?: string | null;
  priority?: string | null;
  company?: { id: string; name: string | null } | null;
  person?: { id: string; name: string | null } | null;
  commentsCount?: number;
}) => {
  const submit = useSubmit();
  const [acceptDrop, setAcceptDrop] = useState<'none' | 'top' | 'bottom'>('none');

  const params = useParams();
  const { companyId } = params;
  const boardId = params.boardId || params.projectId;

  const handleDragStart = (
    e: DragEvent,
    {
      id,
      name,
      columnId,
      ownerId,
      content,
      createdAt,
    }: {
      id: string;
      name: string;
      columnId: string;
      ownerId: string | null;
      content: string | null;
      createdAt: string;
    },
  ) => {
    if (!e || !e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/remix-card',
      JSON.stringify({ id, name, columnId, ownerId, boardId, content, createdAt }),
    );
  };

  const getPriorityColor = (priority: string | null | undefined) => {
    switch (priority) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const isOverdue =
    dueDate && new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();

  const formatTimeAgo = (createdAt: string): string => {
    // Ensure proper date parsing - if date doesn't have timezone info, treat as UTC
    let createdDate: Date;
    // Check if date has timezone info (Z for UTC, or +/-HH:MM pattern)
    const hasTimezone = createdAt.includes('Z') || /[+-]\d{2}:\d{2}$/.test(createdAt);
    if (hasTimezone) {
      // Date has timezone info, parse normally
      createdDate = new Date(createdAt);
    } else {
      // Date doesn't have timezone info, assume UTC and append 'Z'
      createdDate = new Date(createdAt.endsWith('Z') ? createdAt : `${createdAt}Z`);
    }

    const now = Date.now();
    const created = createdDate.getTime();
    const diffMs = now - created;

    // Handle negative differences (future dates) by showing "Recently"
    if (diffMs < 0) {
      return 'Recently';
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Show "Recently" for anything less than 5 minutes
    if (diffMins < 5) {
      return 'Recently';
    }
    // Show minutes for 5-59 minutes
    if (diffMins < 60) {
      return `${diffMins}min`;
    }
    if (diffHours < 24) {
      return `${diffHours}h`;
    }
    return `${diffDays}d`;
  };

  const formatFullTimestamp = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <li
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(
          'application/remix-card',
          JSON.stringify({ id, name, columnId, ownerId, boardId, content, createdAt }),
        );
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/remix-card')) {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const midpoint = (rect.top + rect.bottom) / 2;
          setAcceptDrop(event.clientY <= midpoint ? 'top' : 'bottom');
        }
      }}
      onDragLeave={() => {
        setAcceptDrop('none');
      }}
      onDrop={(event) => {
        event.stopPropagation();

        const transfer = JSON.parse(event.dataTransfer.getData('application/remix-card'));

        if (!transfer.id) throw Error('missing card Id');
        if (!transfer.name) throw Error('missing name');

        const droppedOrder = acceptDrop === 'top' ? previousOrder : nextOrder;
        const moveOrder = (droppedOrder + order) / 2;

        const mutation: TaskType = {
          order: moveOrder,
          columnId: columnId,
          id: transfer.id,
          name: transfer.name,
          ownerId: transfer.ownerId,
          content: transfer.content,
          createdAt: transfer.createdAt,
        };

        submit(
          { ...mutation, intent: 'moveTask' },
          {
            method: 'post',
            navigate: false,
            fetcherKey: `card:${transfer.id}`,
          },
        );

        setAcceptDrop('none');
      }}
      className={
        'border-t-2 border-b-2 -mb-[2px] last:mb-0 cursor-grab active:cursor-grabbing py-1 ' +
        (acceptDrop === 'top'
          ? 'border-t-primary border-b-transparent'
          : acceptDrop === 'bottom'
            ? 'border-b-primary border-t-transparent'
            : 'border-t-transparent border-b-transparent')
      }
    >
      <Link to={boardId ? `/dashboard/${companyId}/projects/${boardId}/${id}` : `/dashboard/${companyId}/tasks/${id}`}>
        <motion.div
          layout
          layoutId={String(id)}
          className="bg-card p-3 flex flex-col gap-2.5 rounded-md active:cursor-grabbing border border-border hover:border-primary/50 transition-colors shadow-sm"
          draggable="true"
          onDragStart={(e: DragEvent) => handleDragStart(e, { name, id, columnId, ownerId, content, createdAt })}
        >
          {/* Title Row */}
          <div className="flex items-start gap-2">
            <Circle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <h3 className="flex-1 text-sm font-semibold line-clamp-1">{name}</h3>
          </div>

          {/* Created By */}
          {owner && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-default">
                    <RotateCcw className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={owner.profilePictureUrl || ''} alt={owner.name || ''} />
                      <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {owner.name ? owner.name[0].toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">{owner.name || 'Unknown'}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <div className="space-y-1">
                    <p className="font-medium">Created by {owner.name || 'Unknown'}</p>
                    <p className="text-xs opacity-90">Created on {formatFullTimestamp(createdAt)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Assignees */}
          {assignees && assignees.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-default">
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1">
                      {assignees.slice(0, 2).map(
                        (assignee, idx) =>
                          assignee.user && (
                            <Avatar key={assignee.user.id || idx} className="h-5 w-5 shrink-0 -ml-1 first:ml-0">
                              <AvatarImage src={assignee.user.profilePictureUrl || ''} alt={assignee.user.name || ''} />
                              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                {assignee.user.name ? assignee.user.name[0].toUpperCase() : 'U'}
                              </AvatarFallback>
                            </Avatar>
                          ),
                      )}
                      {assignees.length > 2 && (
                        <div className="flex h-5 w-5 shrink-0 -ml-1 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground border-2 border-card">
                          +{assignees.length - 2}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {assignees.length === 1 && assignees[0]?.user?.name
                        ? assignees[0].user.name
                        : `${assignees.length} assignee${assignees.length === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <p className="text-xs">Assignees</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Relations Row */}
          {company && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-default">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{company.name || 'Unnamed Company'}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <div className="space-y-1">
                    <p className="font-medium">Company</p>
                    <p className="text-xs opacity-90">{company.name || 'Unnamed Company'}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {person && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-default">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">{person.name || 'Unnamed Person'}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <div className="space-y-1">
                    <p className="font-medium">Person</p>
                    <p className="text-xs opacity-90">{person.name || 'Unnamed Person'}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Status Row */}
          {priority && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <AlertCircle className={'h-3 w-3 text-muted-foreground'} />
                <span className={`text-xs capitalize ${getPriorityColor(priority)}`}>{priority}</span>
              </div>
            </div>
          )}
          {dueDate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <div className="space-y-1">
                    <p className="font-medium">{isOverdue ? 'Overdue' : 'Due Date'}</p>
                    <p className="text-xs opacity-90">
                      {new Date(dueDate).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Footer with Icons */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-row items-center gap-0.5 cursor-default">
                      <MessageCircle className="h-3 w-3 text-muted-foreground" />
                      {commentsCount > 0 && (
                        <span className="text-xs text-muted-foreground leading-none">{commentsCount}</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {commentsCount === 0
                        ? 'No comments'
                        : `${commentsCount} comment${commentsCount === 1 ? '' : 's'}`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-default">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(createdAt)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="font-medium">Created</p>
                    <p className="text-xs opacity-90">{formatFullTimestamp(createdAt)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </motion.div>
      </Link>
    </li>
  );
};

export default TaskTodo;
