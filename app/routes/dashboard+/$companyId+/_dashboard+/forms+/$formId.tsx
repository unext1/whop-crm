import { and, eq } from 'drizzle-orm';
import { Copy, ExternalLink, Menu, MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { data, redirect, useNavigate, useSubmit } from 'react-router';
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
import { Card } from '~/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { db } from '~/db';
import { boardTable, formsTable } from '~/db/schema';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/$formId';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId, formId } = params;
  await requireUser(request, companyId);

  const form = await db.query.formsTable.findFirst({
    where: and(eq(formsTable.id, formId), eq(formsTable.organizationId, companyId)),
  });

  if (!form) {
    throw data('Form not found', { status: 404 });
  }

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
    form,
    pipelineColumns,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId, formId } = params;
  await requireUser(request, companyId);

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'deleteForm') {
    await db.delete(formsTable).where(and(eq(formsTable.id, formId), eq(formsTable.organizationId, companyId)));
    return redirect(`/dashboard/${companyId}/forms`);
  }

  return {};
};

const EditFormPage = ({ loaderData }: Route.ComponentProps) => {
  const { form, companyId, pipelineColumns } = loaderData;
  const navigate = useNavigate();
  const submit = useSubmit();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fields = JSON.parse(form.fields || '[]');
  const formUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/form/${form.id}`;
  const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  const copyLink = () => {
    navigator.clipboard.writeText(formUrl);
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.append('intent', 'deleteForm');
    submit(formData, { method: 'post' });
    setDeleteOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col w-full">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden lg:flex hover:bg-muted"
          onClick={() => navigate(-1)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 overflow-y-auto scrollbar-thin">
        {/* Form Icon and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {form.name?.charAt(0) || 'F'}
          </div>
          <h2 className="text-lg font-semibold mb-1">{form.name}</h2>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Properties</h3>
            <div className="space-y-2">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Entity Type</p>
                <Badge variant="outline" className="h-5 text-xs">
                  {form.entityType === 'both' ? 'Person/Company' : form.entityType === 'person' ? 'Person' : 'Company'}
                </Badge>
              </div>
              {form.entityType === 'both' && form.defaultEntityType && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Default Type</p>
                  <Badge variant="outline" className="h-5 text-xs">
                    {form.defaultEntityType === 'person' ? 'Person' : 'Company'}
                  </Badge>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-1">Fields</p>
                <p className="text-sm font-medium">{fields.length} fields</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Creates Deal</p>
                <Badge variant={form.createDeal ? 'secondary' : 'outline'} className="h-5 text-xs">
                  {form.createDeal ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            </div>
            <div className="space-y-2 text-xs">
              {form.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(form.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {form.updatedAt && form.updatedAt !== form.createdAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(form.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:min-w-80 lg:border-border lg:border-r lg:bg-muted/30">{sidebarContent}</div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Form Details</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Panel */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Header */}
        <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
          <div className="flex items-center w-full gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden items-center flex"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="h-4 w-4" />
              <span className="text-xs">Details</span>
            </Button>

            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {form.name?.charAt(0) || 'F'}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold">{form.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" className="h-8 text-xs" onClick={() => setBuilderOpen(true)}>
              Edit Form
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 border-0 shadow-s">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={copyLink}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyEmbedCode}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Embed Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Delete Form
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-auto p-4 scrollbar-thin">
          <Card className="p-6 bg-muted/30 flex-1 flex flex-col">
            <iframe
              src={formUrl}
              className="w-full flex-1 border-0"
              style={{ overflow: 'auto', display: 'block' }}
              title="Form Preview"
            />
          </Card>
        </div>
      </div>

      {/* Form Builder Dialog */}
      <FormBuilder
        companyId={companyId}
        formId={form.id}
        pipelineColumns={pipelineColumns}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialData={{
          name: form.name,
          description: form.description || undefined,
          entityType: form.entityType,
          defaultEntityType: form.defaultEntityType || undefined,
          allowEntitySelection: form.allowEntitySelection || false,
          createDeal: form.createDeal || false,
          pipelineColumnId: form.pipelineColumnId || undefined,
          successMessage: form.successMessage || undefined,
          fields: fields,
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {form.name}? This action cannot be undone and will permanently remove this
              form and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditFormPage;
