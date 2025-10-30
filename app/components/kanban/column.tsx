import { useSubmit } from 'react-router';
import { useRef, useState } from 'react';

import { Card } from '../ui/card';
import { EditableText } from './editible-text';
import { NewTask } from './new-task';
import Task from './task';

export interface TaskType {
  id: string;
  createdAt: string;
  name: string;
  order: number;
  content: string | null;
  columnId: string;
  ownerId: string | null;
}

interface ColumnProps {
  name: string;
  columnId: string;
  tasks: TaskType[];
  order: number;
}

const Column = ({ name, columnId, tasks }: ColumnProps) => {
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
      className={`shrink-0 flex flex-col max-h-full w-80 p-4 py-6 ${acceptDrop ? 'border border-primary' : ''}`}
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
      <div className="flex items-center space-x-2 bg-background">
        <EditableText
          fieldName="name"
          value={name}
          inputLabel="Edit column name"
          buttonLabel={`Edit column "${name}" name`}
        >
          <input type="hidden" name="intent" value="updateColumn" />
          <input type="hidden" name="columnId" value={columnId} />
        </EditableText>

        {/* <RemoveColumn columnId={columnId} /> */}
        <div
          className="text-xs px-1 py-0.5 bg-se              boardId={task.boardId}
condary rounded"
        >
          {tasks.length}
        </div>
      </div>
      <ul ref={listRef} className="grow mb-4 mt-6">
        {tasks
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((task, index, tasks) => (
            <Task
              key={task.id}
              name={task.name}
              content={task.content}
              id={task.id}
              createdAt={task.createdAt}
              order={task.order ?? 0}
              columnId={columnId}
              ownerId={task.ownerId}
              previousOrder={tasks[index - 1] ? (tasks[index - 1].order ?? 0) : 0}
              nextOrder={tasks[index + 1] ? (tasks[index + 1].order ?? 0) : (task.order ?? 0) + 1}
            />
          ))}
      </ul>

      <NewTask
        columnId={columnId}
        columnName={name}
        nextOrder={tasks.length === 0 ? 1 : (tasks[tasks.length - 1].order ?? 0) + 1}
        onAddCard={() => scrollList()}
        onComplete={() => setEdit(false)}
      />
    </Card>
  );
};

export default Column;
