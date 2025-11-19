import { and, eq } from 'drizzle-orm';
import { ClipboardList, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { data, redirect, useLoaderData, useSubmit } from 'react-router';
import { FormBuilder } from '~/components/form-builder';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { db } from '~/db';
import { boardTable, formsTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);

  const forms = await db.query.formsTable.findMany({
    where: eq(formsTable.organizationId, companyId),
    orderBy: (formsTable, { desc }) => [desc(formsTable.createdAt)],
    with: {
      pipelineColumn: {
        with: {
          board: true,
        },
      },
    },
  });

  // Fetch pipeline columns for the form builder
  const pipelineBoards = await db.query.boardTable.findMany({
    where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'pipeline')),
    with: {
      columns: {
        orderBy: (boardColumnTable, { asc }) => [asc(boardColumnTable.order)],
      },
    },
  });

  const pipelineColumns = pipelineBoards.flatMap((board) =>
    board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      boardName: board.name,
    })),
  );

  return {
    companyId,
    forms,
    pipelineColumns,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createForm' || intent === 'updateForm') {
    const formId = formData.get('formId')?.toString();
    const name = formData.get('name')?.toString();
    const description = formData.get('description')?.toString();
    const entityType = formData.get('entityType')?.toString() as 'person' | 'company' | 'both';
    const defaultEntityType = formData.get('defaultEntityType')?.toString() as 'person' | 'company' | undefined;
    const allowEntitySelection = formData.get('allowEntitySelection')?.toString() === 'true';
    const createDeal = formData.get('createDeal')?.toString() === 'true';
    const pipelineColumnId = formData.get('pipelineColumnId')?.toString() || null;
    const successMessage =
      formData.get('successMessage')?.toString() || "Thank you for your submission! We'll be in touch soon.";
    const fields = formData.get('fields')?.toString();

    // Debug logging
    console.log('[Form Action] Received data:', {
      intent,
      formId,
      name,
      description,
      entityType,
      fieldsLength: fields?.length,
      hasFields: !!fields,
    });

    if (!name || !fields) {
      const headers = await putToast({
        title: 'Error',
        message: `Name and fields are required. Name: ${name ? '✓' : '✗'}, Fields: ${fields ? '✓' : '✗'}`,
        variant: 'destructive',
      });
      return data({ error: 'Missing required fields' }, { headers, status: 400 });
    }

    try {
      if (intent === 'updateForm' && formId) {
        console.log('[Form Action] Updating form:', formId);
        await db
          .update(formsTable)
          .set({
            name,
            description: description || null,
            entityType,
            defaultEntityType: defaultEntityType || null,
            allowEntitySelection: entityType === 'both' ? allowEntitySelection : false,
            createDeal,
            pipelineColumnId,
            successMessage,
            fields,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, companyId)));

        console.log('[Form Action] Form updated successfully');
        const headers = await putToast({
          title: 'Success',
          message: 'Form updated successfully',
          variant: 'default',
        });
        // Return data instead of redirect to prevent navigation when navigate: false is used
        return data({ success: true, formId }, { headers });
      }

      console.log('[Form Action] Creating new form');
      const result = await db
        .insert(formsTable)
        .values({
          name,
          description: description || null,
          slug: `${name.toLowerCase().replace(/ /g, '-')}-${crypto.randomUUID().slice(0, 4)}`,
          entityType,
          defaultEntityType: defaultEntityType || null,
          allowEntitySelection: entityType === 'both' ? allowEntitySelection : false,
          createDeal,
          pipelineColumnId,
          successMessage,
          fields,
          organizationId: companyId,
        })
        .returning();

      console.log('[Form Action] Form created successfully:', result[0]?.id);
      const headers = await putToast({
        title: 'Success',
        message: 'Form created successfully',
        variant: 'default',
      });
      return redirect(`/dashboard/${companyId}/forms`, { headers });
    } catch (error) {
      console.error('[Form Action] Error saving form:', error);
      const headers = await putToast({
        title: 'Error',
        message: `Failed to save form: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
      return data({ error: 'Failed to save form' }, { headers, status: 500 });
    }
  }

  if (intent === 'deleteForm') {
    const formId = formData.get('formId')?.toString();
    if (!formId) {
      const headers = await putToast({
        title: 'Error',
        message: 'Form ID is required',
        variant: 'destructive',
      });
      return data({ error: 'Form ID required' }, { headers, status: 400 });
    }

    try {
      await db.delete(formsTable).where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, companyId)));

      const headers = await putToast({
        title: 'Success',
        message: 'Form deleted successfully',
        variant: 'default',
      });
      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to delete form',
        variant: 'destructive',
      });
      return data({ error: 'Failed to delete form' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

const FormsPage = () => {
  const { forms, companyId, pipelineColumns } = useLoaderData<typeof loader>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const submit = useSubmit();

  const handleDeleteClick = (formId: string) => {
    setFormToDelete(formId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (formToDelete) {
      const formData = new FormData();
      formData.append('intent', 'deleteForm');
      formData.append('formId', formToDelete);
      submit(formData, { method: 'post' });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    }
  };

  const copyEmbedCode = (formId: string) => {
    const embedCode = `<iframe src="${window.location.origin}/form/${formId}" width="100%" height="600" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
  };

  const copyLink = (formId: string) => {
    const link = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Forms</h1>
          {forms.length > 0 && (
            <Badge variant="secondary" className="h-5 text-xs font-normal">
              {forms.length}
            </Badge>
          )}
        </div>
        <Button size="sm" className="h-8 text-xs shadow-s" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Form
        </Button>
        <FormBuilder
          companyId={companyId}
          pipelineColumns={pipelineColumns}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin flex flex-col">
        {forms.length === 3 ? (
          <div className="rounded-lg border border-border border-dashed p-12 bg-muted/30 flex-1 items-center justify-center text-center flex-col flex">
            <h2 className="text-lg font-semibold mb-2">No forms yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Create your first form to start collecting leads</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => {
              const fields = JSON.parse(form.fields || '[]');
              const createdDate = form.createdAt
                ? new Date(form.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : null;
              return (
                <Card
                  key={form.id}
                  className="group bg-linear-to-b from-muted to-muted/30 flex flex-col h-full cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    // Don't navigate if clicking on buttons or links
                    if ((e.target as HTMLElement).closest('button, a')) return;
                    window.location.href = `/dashboard/${companyId}/forms/${form.id}`;
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="shrink-0 text-muted-foreground">
                          <ClipboardList className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold truncate tracking-tight">{form.name}</CardTitle>
                      </div>
                      <Badge
                        variant={form.createDeal ? 'default' : 'outline'}
                        className="h-5 text-[10px] px-1.5 shrink-0 capitalize"
                      >
                        {form.entityType === 'both'
                          ? 'Person/Company'
                          : form.entityType === 'person'
                            ? 'Person'
                            : 'Company'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3 pt-0">
                    {form.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-4">{form.description}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-4">
                        {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                        {form.createDeal && ' • Creates deal'}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{createdDate}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(form.id);
                        }}
                        title="Copy link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyEmbedCode(form.id);
                        }}
                        title="Copy embed code"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(form.id);
                        }}
                        title="Delete form"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this form? This action cannot be undone and will permanently remove this
              form and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormsPage;
