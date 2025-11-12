import { and, eq, isNotNull } from 'drizzle-orm';
import { Building2, FileText, User, CheckSquare, DollarSign, FileTextIcon } from 'lucide-react';
import { Link, useLoaderData } from 'react-router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { db } from '~/db';
import { boardTaskTable } from '~/db/kanban-schemas/board-task';
import { companiesTable } from '~/db/schema/companies';
import { peopleTable } from '~/db/schema/people';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types';
import { boardTable } from '~/db/kanban-schemas';

type NoteItem = {
  id: string;
  entityType: 'person' | 'company' | 'task';
  entityName: string;
  entityId: string;
  notes: string;
  updatedAt: string;
  link: string;
  boardType?: 'tasks' | 'pipeline'; // Only for task entities
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);

  // Fetch all entities with notes
  const [people, companies, board] = await Promise.all([
    db.query.peopleTable.findMany({
      where: and(eq(peopleTable.organizationId, organizationId), isNotNull(peopleTable.notes)),
    }),
    db.query.companiesTable.findMany({
      where: and(eq(companiesTable.organizationId, organizationId), isNotNull(companiesTable.notes)),
    }),
    db.query.boardTable.findMany({
      where: eq(boardTable.companyId, organizationId),
      with: {
        tasks: {
          where: isNotNull(boardTaskTable.notes),
          with: {
            column: true,
          },
        },
      },
    }),
  ]);

  // Combine and format all notes
  const allNotes: NoteItem[] = [
    ...people.map((person) => ({
      id: person.id,
      entityType: 'person' as const,
      entityName: person.name || 'Unnamed Person',
      entityId: person.id,
      notes: person.notes || '',
      updatedAt: person.updatedAt || person.id, // Fallback to id for sorting
      link: `/dashboard/${organizationId}/people/${person.id}`,
    })),
    ...companies.map((company) => ({
      id: company.id,
      entityType: 'company' as const,
      entityName: company.name || 'Unnamed Company',
      entityId: company.id,
      notes: company.notes || '',
      updatedAt: company.updatedAt || company.id,
      link: `/dashboard/${organizationId}/company/${company.id}`,
    })),
    ...board.flatMap((board) =>
      board.tasks.map((task) => ({
        id: task.id,
        entityType: 'task' as const,
        entityName: task.name || 'Unnamed Task',
        entityId: task.id,
        notes: task.notes || '',
        updatedAt: task.updatedAt || task.id,
        boardType: board.type,
        link:
          board.type === 'pipeline'
            ? `/dashboard/${organizationId}/projects/${board.id}/${task.id}`
            : `/dashboard/${organizationId}/tasks/${task.id}`,
      })),
    ),
  ];

  // Sort by most recently updated
  const sortedNotes = allNotes.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });

  return {
    user,
    organizationId,
    notes: sortedNotes,
  };
}

// Helper to strip HTML tags and truncate text
function stripHtml(html: string): string {
  if (typeof document === 'undefined') {
    // Server-side: simple regex approach
    return html.replace(/<[^>]*>/g, '').trim();
  }
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function truncateText(text: string, maxLength = 150): string {
  const plainText = stripHtml(text);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + '...';
}

const NotesPage = () => {
  const { notes } = useLoaderData<typeof loader>();

  const getEntityIcon = (note: NoteItem) => {
    switch (note.entityType) {
      case 'person':
        return <User className="h-4 w-4" />;
      case 'company':
        return <Building2 className="h-4 w-4" />;
      case 'task':
        return note.boardType === 'pipeline' ? <DollarSign className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />;
    }
  };

  const getEntityBadgeColor = (entityType: NoteItem['entityType']) => {
    switch (entityType) {
      case 'person':
        return 'default';
      case 'company':
        return 'default';
      case 'task':
        return 'outline';
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <FileTextIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Notes</h1>
          {notes.length > 0 && (
            <Badge variant="secondary" className="h-5 text-xs">
              {notes.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        {notes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-40">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">No notes yet</h2>
              <p className="text-sm text-muted-foreground">
                Start adding notes to people, companies, or tasks to see them here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note) => (
              <Card
                key={`${note.entityType}-${note.id}`}
                className="shadow-s bg-linear-to-b from-muted to-muted/30 border-0 flex flex-col"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="shrink-0 text-muted-foreground">{getEntityIcon(note)}</div>
                      <CardTitle className="text-sm font-semibold truncate">{note.entityName}</CardTitle>
                    </div>
                    <Badge
                      variant={getEntityBadgeColor(note.entityType)}
                      className="h-5 text-[10px] px-1.5 shrink-0 capitalize"
                    >
                      {note.entityType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <p className="text-xs text-muted-foreground line-clamp-4">{truncateText(note.notes, 200)}</p>
                </CardContent>
                <CardFooter className="pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <Link to={note.link} className="text-xs text-primary hover:underline font-medium">
                    View →
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPage;
