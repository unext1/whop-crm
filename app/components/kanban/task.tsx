import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams, useSubmit } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Circle, DollarSign, FileText, Image as ImageIcon, CheckSquare2, Clock } from 'lucide-react';
import type { TaskType } from './column';

const Task = ({
  name,
  content,
  id,
  order,
  columnId,
  createdAt,
  previousOrder,
  ownerId,
  nextOrder,
  assignees,
}: TaskType & {
  previousOrder: number;
  nextOrder: number;
}) => {
  const submit = useSubmit();
  const [acceptDrop, setAcceptDrop] = useState<'none' | 'top' | 'bottom'>('none');

  const params = useParams();
  const { companyId, boardId } = params;

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
      <Link to={`/dashboard/${companyId}/projects/${boardId}/${id}`}>
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

          {/* Assignee */}
          {assignees && assignees.length > 0 && assignees[0]?.user && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={assignees[0].user.profilePictureUrl || ''} alt={assignees[0].user.name || ''} />
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {assignees[0].user.name ? assignees[0].user.name[0].toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">{assignees[0].user.name || 'Unassigned'}</span>
            </div>
          )}

          {/* Metadata Row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="truncate">Set Deal value...</span>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <CheckSquare2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Set a value...</span>
            </div>
          </div>

          {/* Footer with Icons */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))}d
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </li>
  );
};

export default Task;
