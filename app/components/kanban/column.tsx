import { useSubmit } from 'react-router';
import { useRef, useState } from 'react';

import { Card } from '../ui/card';
import { EditableText } from './editible-text';
import { NewTaskTodo } from './new-task-todo';
import { NewTaskDeal } from './new-task-deal';
import TaskTodo from './task-todo';
import TaskDeal from './task-deal';

export interface TaskType {
  id: string;
  createdAt: string;
  name: string;
  order: number;
  content: string | null;
  columnId: string;
  ownerId: string | null;
  type?: 'tasks' | 'pipeline';
  dueDate?: string | null;
  priority?: string | null;
  amount?: number | null;
  company?: { id: string; name: string | null } | null;
  person?: { id: string; name: string | null } | null;
  assignees?: Array<{
    user: {
      id: string;
      name: string | null;
      profilePictureUrl: string | null;
    };
  }>;
  owner?: {
    id: string;
    name: string | null;
    profilePictureUrl: string | null;
  } | null;
  commentsCount?: number;
}

type Company = {
  id: string;
  name: string | null;
};

type Person = {
  id: string;
  name: string | null;
};

interface ColumnProps {
  name: string;
  columnId: string;
  tasks: TaskType[];
  order: number;
  color?: string;
  disableEdit?: boolean;
  taskType?: 'tasks' | 'pipeline';
  companies?: Company[];
  people?: Person[];
  boardId?: string;
  userId?: string;
}

const COLUMN_COLORS = [
  { name: 'blue', value: 'bg-blue-500' },
  { name: 'pink', value: 'bg-pink-500' },
  { name: 'green', value: 'bg-green-500' },
  { name: 'red', value: 'bg-red-500' },
  { name: 'yellow', value: 'bg-yellow-500' },
  { name: 'purple', value: 'bg-purple-500' },
  { name: 'orange', value: 'bg-orange-500' },
  { name: 'cyan', value: 'bg-cyan-500' },
];

const getColumnColor = (order: number) => {
  return COLUMN_COLORS[order % COLUMN_COLORS.length];
};

const Column = ({
  name,
  columnId,
  tasks,
  order,
  disableEdit = false,
  taskType = 'pipeline',
  companies = [],
  people = [],
  boardId,
  userId,
}: ColumnProps) => {
  const colorConfig = getColumnColor(order);
  const submit = useSubmit();

  const listRef = useRef<HTMLUListElement>(null);
  const [_, setEdit] = useState(false);
  const [acceptDrop, setAcceptDrop] = useState(false);

  function scrollList() {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }

  return (
    <Card
      className={`shrink-0 flex flex-col max-h-full w-72  bg-muted/30 backdrop-blur-md border border-border/50 shadow-sm ${acceptDrop ? 'ring-2 ring-primary' : ''}`}
      onDragOver={(event) => {
        if (tasks.length === 0 && event.dataTransfer.types.includes('application/remix-card')) {
          event.preventDefault();
          setAcceptDrop(true);
        }
      }}
      onDragLeave={() => {
        setAcceptDrop(false);
      }}
      onDrop={(event) => {
        const transfer = JSON.parse(event.dataTransfer.getData('application/remix-card'));
        if (!transfer.id) throw Error('missing card Id');
        if (!transfer.name) throw Error('missing name');

        const mutation = {
          id: String(transfer.id),
          columnId,
          order: 1,
        };

        submit(
          { ...mutation, intent: 'moveTask' },
          {
            method: 'post',
            navigate: false,
            fetcherKey: `card:${transfer.id}`,
          },
        );

        setAcceptDrop(false);
      }}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${colorConfig.value}`} />
          {disableEdit ? (
            <h3 className="text-sm font-semibold truncate">{name}</h3>
          ) : (
            <EditableText
              fieldName="name"
              value={name}
              inputLabel="Edit column name"
              buttonLabel={`Edit column "${name}" name`}
            >
              <input type="hidden" name="intent" value="updateColumn" />
              <input type="hidden" name="columnId" value={columnId} />
            </EditableText>
          )}
        </div>
        {tasks.length > 0 && (
          <div className="text-xs px-1.5 py-0.5 bg-secondary/50 rounded font-medium text-muted-foreground shrink-0 ml-2">
            {tasks.length}
          </div>
        )}
      </div>
      <ul
        ref={listRef}
        className="grow mb-3 space-y-2.5 px-4 scrollbar-thin overflow-y-auto min-h-0 overscroll-contain overflow-x-hidden"
      >
        {tasks
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((task, index, tasks) => {
            const commonProps = {
              name: task.name,
              content: task.content,
              id: task.id,
              createdAt: task.createdAt,
              order: task.order ?? 0,
              columnId,
              ownerId: task.ownerId,
              owner: task.owner,
              assignees: task.assignees,
              previousOrder: tasks[index - 1] ? (tasks[index - 1].order ?? 0) : 0,
              nextOrder: tasks[index + 1] ? (tasks[index + 1].order ?? 0) : (task.order ?? 0) + 1,
              commentsCount: task.commentsCount ?? 0,
            };

            if (taskType === 'tasks') {
              return (
                <TaskTodo
                  key={task.id}
                  {...commonProps}
                  dueDate={task.dueDate}
                  priority={task.priority}
                  company={task.company}
                  person={task.person}
                />
              );
            }
            return (
              <TaskDeal
                key={task.id}
                {...commonProps}
                company={task.company}
                person={task.person}
                amount={task.amount}
              />
            );
          })}
      </ul>

      {taskType === 'tasks' ? (
        <NewTaskTodo
          columnId={columnId}
          columnName={name}
          nextOrder={tasks.length === 0 ? 1 : (tasks[tasks.length - 1].order ?? 0) + 1}
          onAddCard={() => scrollList()}
          onComplete={() => setEdit(false)}
          companies={companies}
          people={people}
          boardId={boardId}
          userId={userId}
        />
      ) : (
        <NewTaskDeal
          columnId={columnId}
          columnName={name}
          nextOrder={tasks.length === 0 ? 1 : (tasks[tasks.length - 1].order ?? 0) + 1}
          onAddCard={() => scrollList()}
          onComplete={() => setEdit(false)}
          companies={companies}
          people={people}
          boardId={boardId}
          userId={userId}
        />
      )}
    </Card>
  );
};

export default Column;
