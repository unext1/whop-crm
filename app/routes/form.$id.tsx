import { and, eq } from 'drizzle-orm';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { data, useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { db } from '~/db';
import {
  boardColumnTable,
  boardTable,
  boardTaskTable,
  companiesTable,
  emailsTable,
  formsTable,
  peopleEmailsTable,
  peopleTable,
} from '~/db/schema';
import type { FormFieldConfig } from '~/db/schema/forms';
import { logCompanyActivity, logPersonActivity, logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types/form.$id';
import { csrf } from '~/services/csrf.server';
import { AuthenticityTokenInput } from 'remix-utils/csrf/react';

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { id } = params;

  // Get form
  const form = await db.query.formsTable.findFirst({
    where: eq(formsTable.id, id),
    with: {
      organization: true,
      pipelineColumn: true,
    },
  });

  if (!form) {
    throw data('Form not found', { status: 404 });
  }

  return {
    form,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  await csrf.validate(request);
  const { id } = params;
  const formData = await request.formData();

  // Get form
  const form = await db.query.formsTable.findFirst({
    where: eq(formsTable.id, id),
    with: {
      organization: true,
      pipelineColumn: true,
    },
  });

  if (!form) {
    return data({ error: 'Form not found' }, { status: 404 });
  }

  const fields = JSON.parse(form.fields || '[]') as FormFieldConfig[];
  const entityType = formData.get('entityType')?.toString() || form.defaultEntityType || 'person';

  // Validate required fields
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    if (field.required) {
      const value = formData.get(field.name)?.toString();
      if (!value || value.trim().length === 0) {
        errors[field.name] = `${field.label} is required`;
      }
    }
  });

  if (Object.keys(errors).length > 0) {
    return data({ errors, field: 'general' }, { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      let entityId: string | null = null;
      const entityTypeFinal: 'person' | 'company' = entityType as 'person' | 'company';

      // Create person or company
      if (entityTypeFinal === 'person') {
        const personData: Record<string, string | null> = {};
        fields.forEach((field) => {
          if (field.entityField) {
            const value = formData.get(field.name)?.toString()?.trim();
            if (value) {
              personData[field.entityField] = value;
            }
          }
        });

        // Ensure name exists
        if (!personData.name) {
          personData.name = formData.get('name')?.toString()?.trim() || 'Unknown';
        }

        const [newPerson] = await tx
          .insert(peopleTable)
          .values({
            name: personData.name,
            description: personData.description || null,
            jobTitle: personData.jobTitle || null,
            phone: personData.phone || null,
            linkedin: personData.linkedin || null,
            twitter: personData.twitter || null,
            website: personData.website || null,
            address: personData.address || null,
            organizationId: form.organizationId,
            notes: null,
          })
          .returning();

        entityId = newPerson.id;

        // Handle email separately
        const emailValue = formData.get('email')?.toString()?.trim();
        if (emailValue) {
          const existingEmail = await tx.query.emailsTable.findFirst({
            where: and(eq(emailsTable.email, emailValue), eq(emailsTable.organizationId, form.organizationId)),
          });

          let emailId: string;
          if (existingEmail) {
            emailId = existingEmail.id;
          } else {
            const [newEmail] = await tx
              .insert(emailsTable)
              .values({
                email: emailValue,
                organizationId: form.organizationId,
                isPrimary: true,
                type: 'work',
              })
              .returning();
            emailId = newEmail.id;
          }

          await tx.insert(peopleEmailsTable).values({
            personId: newPerson.id,
            emailId,
          });
        }

        // Log activity
        await logPersonActivity({
          personId: newPerson.id,
          userId: null,
          activityType: 'created',
          description: `Created from form: ${form.name}`,
          metadata: { formId: form.id, formName: form.name },
          tx,
        });
      } else {
        // Create company
        const companyData: Record<string, string | null> = {};
        fields.forEach((field) => {
          if (field.entityField) {
            const value = formData.get(field.name)?.toString()?.trim();
            if (value) {
              companyData[field.entityField] = value;
            }
          }
        });

        // Ensure name exists
        if (!companyData.name) {
          companyData.name = formData.get('name')?.toString()?.trim() || 'Unknown Company';
        }

        const [newCompany] = await tx
          .insert(companiesTable)
          .values({
            name: companyData.name,
            description: companyData.description || null,
            domain: companyData.domain || null,
            website: companyData.website || null,
            industry: companyData.industry || null,
            address: companyData.address || null,
            phone: companyData.phone || null,
            linkedin: companyData.linkedin || null,
            twitter: companyData.twitter || null,
            organizationId: form.organizationId,
            notes: null,
          })
          .returning();

        entityId = newCompany.id;

        // Log activity
        await logCompanyActivity({
          companyId: newCompany.id,
          userId: null,
          activityType: 'created',
          description: `Created from form: ${form.name}`,
          metadata: { formId: form.id, formName: form.name },
          tx,
        });
      }

      // Create deal if configured
      if (form.createDeal && form.pipelineColumnId && entityId) {
        const pipelineBoard = await tx.query.boardTable.findFirst({
          where: and(eq(boardTable.companyId, form.organizationId), eq(boardTable.type, 'pipeline')),
          with: {
            columns: {
              where: eq(boardColumnTable.id, form.pipelineColumnId),
            },
          },
        });

        if (pipelineBoard && pipelineBoard.columns.length > 0) {
          const column = pipelineBoard.columns[0];
          const maxOrderTask = await tx.query.boardTaskTable.findFirst({
            where: eq(boardTaskTable.columnId, column.id),
            orderBy: (tasks, { desc }) => [desc(tasks.order)],
          });

          const nextOrder = maxOrderTask?.order ? maxOrderTask.order + 1 : 1;
          const dealName =
            entityTypeFinal === 'person'
              ? `Lead: ${formData.get('name')?.toString() || 'Unknown'}`
              : `Deal: ${formData.get('name')?.toString() || 'Unknown Company'}`;

          const [deal] = await tx
            .insert(boardTaskTable)
            .values({
              columnId: column.id,
              boardId: pipelineBoard.id,
              name: dealName,
              order: nextOrder,
              type: 'pipeline',
              status: 'open',
              [entityTypeFinal === 'person' ? 'personId' : 'companyId']: entityId,
            })
            .returning();

          await logTaskActivity({
            taskId: deal.id,
            userId: null,
            activityType: 'created',
            description: `Created from form: ${form.name}`,
            tx,
          });
        }
      }
    });

    return data(
      {
        success: true,
        message: form.successMessage || "Thank you for your submission! We'll be in touch soon.",
      },
      { status: 200 },
    );
  } catch {
    return data(
      {
        error: 'Something went wrong. Please try again.',
        field: 'general',
      },
      { status: 500 },
    );
  }
};

const PublicForm = ({ loaderData }: Route.ComponentProps) => {
  const { form } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === 'submitting' || fetcher.state === 'loading';

  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<'person' | 'company'>(
    (form.defaultEntityType as 'person' | 'company') || 'person',
  );

  const fields = JSON.parse(form.fields || '[]') as FormFieldConfig[];

  // Show success message if we have successful submission
  useEffect(() => {
    if (fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
      setShowSuccess(true);
    }
  }, [fetcher.data]);

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center border border-border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-6">
            {fetcher.data && 'message' in fetcher.data
              ? fetcher.data.message
              : "We've received your information and will be in touch soon."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto bg-linear-to-b from-muted to-muted/30 rounded-lg shadow-s shadow-lg  my-8">
        {/* Header */}
        <div className="bg-black/10 px-6 py-8 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">{form.name}</h1>
          {form.description && <p className="text-muted-foreground mt-2">{form.description}</p>}
        </div>

        {/* Form */}
        <div className="p-6">
          <fetcher.Form method="post" action={`/form/${form.id}`} className="space-y-6">
            <AuthenticityTokenInput />

            {form.entityType === 'both' && form.allowEntitySelection && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">I am submitting as:</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedEntityType('person')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedEntityType === 'person'
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedEntityType === 'person' ? 'border-primary' : 'border-muted-foreground'
                        }`}
                      >
                        {selectedEntityType === 'person' && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-semibold text-sm">Individual</span>
                    </div>
                    <p className="text-xs text-muted-foreground">I'm submitting for myself</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEntityType('company')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedEntityType === 'company'
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedEntityType === 'company' ? 'border-primary' : 'border-muted-foreground'
                        }`}
                      >
                        {selectedEntityType === 'company' && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-semibold text-sm">Company</span>
                    </div>
                    <p className="text-xs text-muted-foreground">I'm submitting for my business</p>
                  </button>
                </div>
                <input type="hidden" name="entityType" value={selectedEntityType} />
              </div>
            )}

            {/* Form Fields */}
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2 text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="min-h-[100px]"
                  />
                ) : field.type === 'select' && field.options ? (
                  <Select name={field.name} required={field.required}>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="h-11"
                  />
                )}
                {fetcher.data && 'errors' in fetcher.data && fetcher.data.errors?.[field.name] && (
                  <p className="text-sm text-destructive">{fetcher.data.errors[field.name]}</p>
                )}
              </div>
            ))}

            {/* General error */}
            {fetcher.data && 'error' in fetcher.data && 'field' in fetcher.data && fetcher.data.field === 'general' && (
              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                <p className="text-sm text-destructive">{fetcher.data.error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting} className="w-full h-10 text-base font-medium">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </fetcher.Form>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 px-6 py-4 text-center text-sm text-muted-foreground border-t border-border">
          Powered by {form.organization.name}
        </div>
      </div>
    </div>
  );
};

export default PublicForm;
