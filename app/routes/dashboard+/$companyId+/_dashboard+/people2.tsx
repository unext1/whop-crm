import type { ColumnDef } from '@tanstack/react-table';
import { and, eq, inArray } from 'drizzle-orm';
import * as React from 'react';
import { data, useFetcher, useFetchers, useLoaderData, useSubmit } from 'react-router';
import { DataGrid } from '~/components/data-grid/data-grid';
import { DataGridFilterList } from '~/components/data-grid/data-grid-filter-list';
import { DataGridKeyboardShortcuts } from '~/components/data-grid/data-grid-keyboard-shortcuts';
import { DataGridRowHeightMenu } from '~/components/data-grid/data-grid-row-height-menu';
import { DataGridSortMenu } from '~/components/data-grid/data-grid-sort-menu';
import { DataGridViewMenu } from '~/components/data-grid/data-grid-view-menu';
import { Checkbox } from '~/components/ui/checkbox';
import { Button } from '~/components/ui/button';
import { Download, Mail, Tag, X } from 'lucide-react';
import { db } from '~/db';
import { emailsTable, peopleEmailsTable, peopleTable, type PeopleType } from '~/db/schema';
import { type UseDataGridProps, useDataGrid } from '~/hooks/use-data-grid';
import { requireUser } from '~/services/whop.server';
import { useWindowSize } from '~/hooks/use-window-size';
import { applyDataGridFilters } from '~/utils/data-grid-filter';
import type { ExtendedColumnFilter } from '~/components/data-table/types/data-table';
import type { Route } from './+types';

type Person = PeopleType & {
  primaryEmail?: string | null;
  emails?: string[]; // Array of email addresses for the creatable combobox
};

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId } = params;
  await requireUser(request, organizationId);

  // Fetch all people for the organization
  const peopleData = await db.query.peopleTable.findMany({
    where: eq(peopleTable.organizationId, organizationId),
    orderBy: peopleTable.createdAt,
    with: {
      peopleEmails: {
        with: {
          email: true,
        },
      },
    },
  });

  // Transform data to include primary email and all emails array
  const people: Person[] = peopleData.map((person) => ({
    ...person,
    primaryEmail:
      person.peopleEmails.find((pe) => pe.email.isPrimary)?.email.email || person.peopleEmails[0]?.email.email || null,
    emails: person.peopleEmails.map((pe) => pe.email.email),
  }));

  return {
    organizationId,
    people,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  await requireUser(request, organizationId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  // Update person field
  if (intent === 'updatePersonField') {
    const personId = formData.get('personId')?.toString();
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!personId || !fieldName) {
      return data({ error: 'Person ID and field name required' }, { status: 400 });
    }

    const allowedFields = [
      'name',
      'description',
      'jobTitle',
      'phone',
      'address',
      'website',
      'linkedin',
      'twitter',
      'notes',
    ];

    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    // Name is required, other fields can be null
    if (fieldName === 'name' && !fieldValue?.trim()) {
      return data({ error: 'Name is required' }, { status: 400 });
    }

    try {
      await db
        .update(peopleTable)
        .set({ [fieldName]: fieldName === 'name' ? fieldValue : fieldValue || null })
        .where(and(eq(peopleTable.id, personId), eq(peopleTable.organizationId, organizationId)));

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to update field' }, { status: 500 });
    }
  }

  // Update emails
  if (intent === 'updateEmails') {
    const personId = formData.get('personId')?.toString();
    const emailsData = formData.getAll('emails') as string[];
    const emailTypes = formData.getAll('emailTypes') as string[];
    const primaryIndex = formData.get('primaryIndex')
      ? Number.parseInt(formData.get('primaryIndex') as string, 10)
      : -1;

    if (!personId) {
      return data({ error: 'Person ID required' }, { status: 400 });
    }

    try {
      await db.transaction(async (tx) => {
        // Get current emails for this person
        const currentPeopleEmails = await tx.query.peopleEmailsTable.findMany({
          where: eq(peopleEmailsTable.personId, personId),
          with: {
            email: true,
          },
        });

        const newEmailAddresses = new Set(emailsData.filter(Boolean));

        // Find emails to remove (in current but not in new)
        const emailsToRemove = currentPeopleEmails.filter((pe) => !newEmailAddresses.has(pe.email.email));

        // Remove old email relationships
        if (emailsToRemove.length > 0) {
          await tx.delete(peopleEmailsTable).where(
            and(
              eq(peopleEmailsTable.personId, personId),
              inArray(
                peopleEmailsTable.emailId,
                emailsToRemove.map((pe) => pe.email.id),
              ),
            ),
          );
        }

        // Add or update emails
        for (let i = 0; i < emailsData.length; i++) {
          const email = emailsData[i]?.trim();
          if (!email) continue;

          const type = (emailTypes[i] || 'work') as 'work' | 'personal' | 'other';
          const isPrimary = i === primaryIndex;

          // Check if email already exists in this organization
          const existingEmail = await tx.query.emailsTable.findFirst({
            where: and(eq(emailsTable.email, email), eq(emailsTable.organizationId, organizationId)),
          });

          let emailId: string;

          if (existingEmail) {
            emailId = existingEmail.id;
            // Update if marking as primary
            if (isPrimary && !existingEmail.isPrimary) {
              await tx.update(emailsTable).set({ isPrimary: true, type }).where(eq(emailsTable.id, emailId));
            }
            // Check if relationship exists
            const existingRelationship = await tx.query.peopleEmailsTable.findFirst({
              where: and(eq(peopleEmailsTable.personId, personId), eq(peopleEmailsTable.emailId, emailId)),
            });
            if (!existingRelationship) {
              await tx.insert(peopleEmailsTable).values({ personId, emailId });
            }
          } else {
            // Create new email
            const insert = await tx
              .insert(emailsTable)
              .values({
                email,
                organizationId,
                type,
                isPrimary,
              })
              .returning();
            emailId = insert[0].id;
            await tx.insert(peopleEmailsTable).values({ personId, emailId });
          }
        }
      });

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to update emails' }, { status: 500 });
    }
  }

  // Delete people
  if (intent === 'deletePeople') {
    const personIds = formData.getAll('personIds') as string[];

    if (personIds.length === 0) {
      return data({ error: 'No person IDs provided' }, { status: 400 });
    }

    try {
      await db
        .delete(peopleTable)
        .where(and(eq(peopleTable.organizationId, organizationId), inArray(peopleTable.id, personIds)));

      return data({ success: true });
    } catch {
      return data({ error: 'Failed to delete people' }, { status: 500 });
    }
  }

  // Create new person
  if (intent === 'createPerson') {
    try {
      const [newPerson] = await db
        .insert(peopleTable)
        .values({
          name: 'New Person',
          organizationId,
        })
        .returning();

      // Fetch the full person with emails
      const fullPerson = await db.query.peopleTable.findFirst({
        where: eq(peopleTable.id, newPerson.id),
        with: {
          peopleEmails: {
            with: {
              email: true,
            },
          },
        },
      });

      if (!fullPerson) {
        return data({ error: 'Failed to fetch created person' }, { status: 500 });
      }

      const personWithEmails: Person = {
        ...fullPerson,
        primaryEmail:
          fullPerson.peopleEmails.find((pe) => pe.email.isPrimary)?.email.email ||
          fullPerson.peopleEmails[0]?.email.email ||
          null,
        emails: fullPerson.peopleEmails.map((pe) => pe.email.email),
      };

      return data({ success: true, person: personWithEmails });
    } catch {
      return data({ error: 'Failed to create person' }, { status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

// Optimistic UI helper
const usePendingPeople = () => {
  const fetchers = useFetchers();
  return React.useMemo(() => {
    const pendingUpdates = new Map<string, Partial<Person>>();

    fetchers
      .filter((fetcher) => fetcher.formData?.get('intent') === 'updatePersonField')
      .forEach((fetcher) => {
        const personId = fetcher.formData?.get('personId')?.toString();
        const fieldName = fetcher.formData?.get('fieldName')?.toString();
        const fieldValue = fetcher.formData?.get('fieldValue')?.toString();

        if (personId && fieldName) {
          const existing = pendingUpdates.get(personId) || {};
          pendingUpdates.set(personId, {
            ...existing,
            [fieldName]: fieldValue || null,
          });
        }
      });

    return pendingUpdates;
  }, [fetchers]);
};

// Track pending deletes from fetchers for optimistic UI
const usePendingDeletes = () => {
  const fetchers = useFetchers();
  return React.useMemo(() => {
    const pendingDeleteIds = new Set<string>();

    fetchers
      .filter((fetcher) => fetcher.formData?.get('intent') === 'deletePeople')
      .forEach((fetcher) => {
        const personIds = fetcher.formData?.getAll('personIds') as string[];
        personIds.forEach((id) => {
          if (id) pendingDeleteIds.add(id);
        });
      });

    return pendingDeleteIds;
  }, [fetchers]);
};

const People2Page = () => {
  const { people: initialPeople } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const createFetcher = useFetcher<typeof action>();
  const windowSize = useWindowSize({ defaultHeight: 760 });
  const pendingUpdates = usePendingPeople();
  const pendingDeleteIds = usePendingDeletes();

  // Merge server data with optimistic updates and filter out pending deletes
  const people = React.useMemo(() => {
    return initialPeople
      .filter((person) => !pendingDeleteIds.has(person.id)) // Filter out pending deletes
      .map((person) => {
        const updates = pendingUpdates.get(person.id);
        return updates ? { ...person, ...updates } : person;
      });
  }, [initialPeople, pendingUpdates, pendingDeleteIds]);

  const [data, setData] = React.useState<Person[]>(people);
  const previousDataRef = React.useRef<Person[]>(people);
  const isEditingRef = React.useRef(false);
  const lastSyncRef = React.useRef<string>('');

  // Handle successful create/delete responses
  React.useEffect(() => {
    if (createFetcher.data && 'person' in createFetcher.data) {
      const response = createFetcher.data as { person?: Person };
      if (response.person) {
        // Replace temp person with real person from server
        const tempPersons = data.filter((p) => p.id.startsWith('temp-'));
        if (tempPersons.length > 0 && response.person) {
          setData((prev) => {
            const withoutTemp = prev.filter((p) => !p.id.startsWith('temp-'));
            return [...withoutTemp, response.person as Person];
          });
        }
      }
    }
  }, [createFetcher.data, data]);

  // Sync data when loader data changes (but only if not currently editing and data actually changed)
  React.useEffect(() => {
    if (isEditingRef.current) return;
    if (createFetcher.state === 'submitting') return;

    // Create a stable hash of the data to detect actual changes
    const dataHash = JSON.stringify(
      people.map((p) => ({
        id: p.id,
        name: p.name,
        jobTitle: p.jobTitle,
        phone: p.phone,
        website: p.website,
        linkedin: p.linkedin,
        twitter: p.twitter,
        address: p.address,
        description: p.description,
        notes: p.notes,
        primaryEmail: p.primaryEmail,
      })),
    );

    // Only update if the hash actually changed
    if (dataHash !== lastSyncRef.current) {
      lastSyncRef.current = dataHash;
      previousDataRef.current = people;
      setData(people);
    }
  }, [people, createFetcher.state]);

  // Handle email updates
  const handleEmailUpdate = React.useCallback(
    (
      personId: string,
      emails: string[],
      newEmails?: Array<{ email: string; type: 'work' | 'personal' | 'other'; isPrimary: boolean }>,
    ) => {
      const formData = new FormData();
      formData.append('intent', 'updateEmails');
      formData.append('personId', personId);

      // Map new emails to types if provided
      const emailTypeMap = new Map<string, { type: 'work' | 'personal' | 'other'; isPrimary: boolean }>();
      if (newEmails && newEmails.length > 0) {
        newEmails.forEach((email) => {
          emailTypeMap.set(email.email, { type: email.type, isPrimary: email.isPrimary });
        });
      }

      emails.forEach((email, index) => {
        formData.append('emails', email);
        const emailInfo = emailTypeMap.get(email);
        formData.append('emailTypes', emailInfo?.type || 'work');
        if (emailInfo?.isPrimary) {
          formData.append('primaryIndex', index.toString());
        }
      });

      submit(formData, { method: 'post', navigate: false });
    },
    [submit],
  );

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        ),
        cell: ({ row, table }) => {
          // Get the display row index (accounts for sorting)
          const rows = table.getRowModel().rows;
          const displayRowIndex = rows.findIndex((r) => r.original === row.original);
          const rowIndex = displayRowIndex >= 0 ? displayRowIndex : row.index;

          return (
            <Checkbox
              aria-label="Select row"
              className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
              checked={row.getIsSelected()}
              onCheckedChange={(value) => {
                const onRowSelect = table.options.meta?.onRowSelect;
                if (onRowSelect) {
                  onRowSelect(rowIndex, !!value, false);
                } else {
                  row.toggleSelected(!!value);
                }
              }}
              onClick={(event: React.MouseEvent) => {
                if (event.shiftKey) {
                  event.preventDefault();
                  const onRowSelect = table.options.meta?.onRowSelect;
                  if (onRowSelect) {
                    onRowSelect(rowIndex, !row.getIsSelected(), true);
                  }
                }
              }}
            />
          );
        },
        size: 40,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        minSize: 200,
        enableColumnFilter: true,
        meta: {
          label: 'Name',
          variant: 'text',
          cell: {
            variant: 'short-text',
          },
        },
      },
      {
        id: 'jobTitle',
        accessorKey: 'jobTitle',
        header: 'Job Title',
        minSize: 180,
        enableColumnFilter: true,
        meta: {
          label: 'Job Title',
          variant: 'text',
          cell: {
            variant: 'short-text',
          },
        },
      },
      {
        id: 'emails',
        accessorKey: 'emails',
        header: 'Emails',
        minSize: 300,
        meta: {
          label: 'Emails',
          cell: {
            variant: 'email',
            onEmailUpdate: handleEmailUpdate,
          },
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'Phone',
        minSize: 150,
        enableColumnFilter: true,
        meta: {
          label: 'Phone',
          variant: 'text',
          cell: {
            variant: 'short-text',
          },
        },
      },
      {
        id: 'website',
        accessorKey: 'website',
        header: 'Website',
        minSize: 200,
        meta: {
          label: 'Website',
          cell: {
            variant: 'url',
          },
        },
      },
      {
        id: 'linkedin',
        accessorKey: 'linkedin',
        header: 'LinkedIn',
        minSize: 200,
        meta: {
          label: 'LinkedIn',
          cell: {
            variant: 'url',
          },
        },
      },
      {
        id: 'twitter',
        accessorKey: 'twitter',
        header: 'Twitter',
        minSize: 180,
        meta: {
          label: 'Twitter',
          cell: {
            variant: 'url',
          },
        },
      },
      {
        id: 'address',
        accessorKey: 'address',
        header: 'Address',
        minSize: 200,
        enableColumnFilter: true,
        meta: {
          label: 'Address',
          variant: 'text',
          cell: {
            variant: 'short-text',
          },
        },
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        minSize: 200,
        meta: {
          label: 'Description',
          cell: {
            variant: 'long-text',
          },
        },
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: 'Notes',
        minSize: 200,
        meta: {
          label: 'Notes',
          cell: {
            variant: 'long-text',
          },
        },
      },
    ],
    [handleEmailUpdate],
  );

  const onDataChange = React.useCallback(
    (newData: Person[]) => {
      const previousData = previousDataRef.current;

      // Mark that we're editing to prevent sync conflicts
      isEditingRef.current = true;

      // Update local state
      setData(newData);
      previousDataRef.current = newData;

      // Find what changed and submit updates to server
      // Only compare rows that exist in both arrays and have the same ID
      const maxLength = Math.min(newData.length, previousData.length);
      const updatesToSubmit: Array<{ personId: string; fieldName: string; fieldValue: string }> = [];

      for (let i = 0; i < maxLength; i++) {
        const newRow = newData[i];
        const oldRow = previousData[i];

        if (!newRow || !oldRow || newRow.id !== oldRow.id) continue;

        // Check each field for changes
        const fields = [
          'name',
          'description',
          'jobTitle',
          'phone',
          'address',
          'website',
          'linkedin',
          'twitter',
          'notes',
        ];
        for (const fieldName of fields) {
          const newValue = newRow[fieldName as keyof Person];
          const oldValue = oldRow[fieldName as keyof Person];

          // Only submit if value actually changed
          if (newValue !== oldValue) {
            updatesToSubmit.push({
              personId: newRow.id,
              fieldName,
              fieldValue: String(newValue ?? ''),
            });
          }
        }
      }

      // Submit all updates at once to avoid multiple renders
      if (updatesToSubmit.length > 0) {
        updatesToSubmit.forEach((update) => {
          const formData = new FormData();
          formData.append('intent', 'updatePersonField');
          formData.append('personId', update.personId);
          formData.append('fieldName', update.fieldName);
          formData.append('fieldValue', update.fieldValue);

          submit(formData, {
            method: 'post',
            navigate: false,
          });
        });
      }

      // Reset editing flag after a short delay to allow sync to resume
      setTimeout(() => {
        isEditingRef.current = false;
      }, 100);
    },
    [submit],
  );

  const onRowAdd: NonNullable<UseDataGridProps<Person>['onRowAdd']> = React.useCallback(() => {
    // Optimistically add a new row at the end
    const tempId = `temp-${Date.now()}`;
    const newPerson: Person = {
      id: tempId,
      name: 'New Person',
      description: null,
      jobTitle: null,
      phone: null,
      linkedin: null,
      twitter: null,
      website: null,
      address: null,
      notes: null,
      whopUserId: null,
      organizationId: initialPeople[0]?.organizationId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emails: [],
      primaryEmail: null,
    };

    setData((prev) => [...prev, newPerson]);
    previousDataRef.current = [...data, newPerson];

    // Submit to server
    const formData = new FormData();
    formData.append('intent', 'createPerson');

    createFetcher.submit(formData, {
      method: 'post',
    });

    return {
      rowIndex: data.length,
      columnId: 'name',
    };
  }, [data, initialPeople, createFetcher]);

  const onRowsDelete: NonNullable<UseDataGridProps<Person>['onRowsDelete']> = React.useCallback((rows, _rowIndices) => {
    console.log('[onRowsDelete] Called with rows:', rows);
    if (rows.length === 0) {
      console.log('[onRowsDelete] No rows to delete');
      return;
    }

    const personIds = rows.map((row) => row.id).filter(Boolean);
    console.log('[onRowsDelete] Person IDs to delete:', personIds);

    if (personIds.length === 0) {
      console.log('[onRowsDelete] No valid person IDs found');
      return;
    }

    // Optimistically remove rows from local state
    setData((prev) => {
      const filtered = prev.filter((p) => !personIds.includes(p.id));
      console.log(
        '[onRowsDelete] Optimistically removed rows. Previous count:',
        prev.length,
        'New count:',
        filtered.length,
      );
      previousDataRef.current = filtered;
      return filtered;
    });

    // Note: Submission is handled by the caller (context menu or keyboard handler)
    // This callback only handles optimistic UI updates
    console.log('[onRowsDelete] Optimistic update complete. Submission should be handled by caller.');
  }, []);

  // Store filters in state so filter list can update them
  const [filters, setFilters] = React.useState<ExtendedColumnFilter<Person>[]>([]);
  const [joinOperator, setJoinOperator] = React.useState<'and' | 'or'>('and');

  // Filter data based on filters
  const filteredData = React.useMemo(() => {
    if (filters.length === 0) return data;
    const filtered = applyDataGridFilters(data, filters, joinOperator);
    return filtered;
  }, [data, filters, joinOperator]);

  const { table, ...dataGridProps } = useDataGrid({
    columns,
    data: filteredData,
    onDataChange,
    onRowAdd,
    onRowsDelete,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: {
        left: ['select'],
      },
    },
    enableSearch: true,
  });

  // Force virtualizer to remeasure when filtered data length changes
  const prevFilteredLengthRef = React.useRef(filteredData.length);
  React.useEffect(() => {
    if (prevFilteredLengthRef.current !== filteredData.length) {
      prevFilteredLengthRef.current = filteredData.length;
      // Use requestAnimationFrame to ensure DOM has updated
      const rafId = requestAnimationFrame(() => {
        if (dataGridProps.rowVirtualizer) {
          dataGridProps.rowVirtualizer.measure();
          // Force update positions after remeasure
          requestAnimationFrame(() => {
            const virtualItems = dataGridProps.rowVirtualizer.getVirtualItems();
            virtualItems.forEach((virtualRow) => {
              const rowRef = dataGridProps.rowMapRef.current?.get(virtualRow.index);
              if (rowRef) {
                rowRef.style.transform = `translateY(${virtualRow.start}px)`;
                rowRef.style.top = '0';
              }
            });
          });
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [filteredData.length, dataGridProps.rowVirtualizer, dataGridProps.rowMapRef]);

  const height = Math.max(400, windowSize.height - 150);

  // Handle delete key for selected rows
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.contentEditable === 'true')
      ) {
        return;
      }

      // Handle Delete key (with or without Ctrl/Cmd)
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedRows = table.getSelectedRowModel().rows;
        console.log('[Keyboard Delete] Selected rows:', selectedRows.length);
        if (selectedRows.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          const rows = selectedRows.map((r) => r.original);
          const rowIndices = selectedRows.map((r) => r.index);
          const personIds = rows.map((r) => r.id).filter(Boolean);

          console.log('[Keyboard Delete] Person IDs:', personIds);

          // Optimistic update via callback
          onRowsDelete(rows, rowIndices);

          // Submit to server
          if (personIds.length > 0) {
            const formData = new FormData();
            formData.append('intent', 'deletePeople');
            personIds.forEach((id) => {
              formData.append('personIds', id);
            });

            console.log('[Keyboard Delete] Submitting delete request');
            submit(formData, {
              method: 'post',
              navigate: false,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table, onRowsDelete, submit]);

  const selectedRowCount = table.getSelectedRowModel().rows.length;
  const selectedRows = table.getSelectedRowModel().rows;

  // Export selected rows to CSV
  const handleExportSelected = React.useCallback(() => {
    if (selectedRows.length === 0) return;

    const headers = ['Name', 'Job Title', 'Email', 'Phone', 'Website', 'LinkedIn', 'Twitter', 'Address'];
    const rows = selectedRows.map((row) => {
      const person = row.original;
      return [
        person.name || '',
        person.jobTitle || '',
        person.primaryEmail || person.emails?.[0] || '',
        person.phone || '',
        person.website || '',
        person.linkedin || '',
        person.twitter || '',
        person.address || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `people-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedRows]);

  // Clear selection
  const handleClearSelection = React.useCallback(() => {
    table.resetRowSelection();
  }, [table]);

  return (
    <div className="flex flex-col gap-4 p-4 relative">
      <div role="toolbar" aria-orientation="horizontal" className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <DataGridFilterList
            table={table}
            align="end"
            filters={filters}
            onFiltersChange={(newFilters) => setFilters(newFilters)}
            joinOperator={joinOperator}
            onJoinOperatorChange={(newOperator) => setJoinOperator(newOperator)}
          />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      </div>
      <DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
      <DataGrid {...dataGridProps} table={table} height={height} />

      {/* Floating Action Bar for Selected Rows */}
      {selectedRowCount > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4"
          data-grid-action-bar=""
        >
          <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {selectedRowCount} {selectedRowCount === 1 ? 'row' : 'rows'} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportSelected} className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Implement bulk email
                  console.log(
                    'Bulk email to:',
                    selectedRows.map((r) => r.original),
                  );
                }}
                className="h-8 text-xs"
                disabled
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Implement bulk tag
                  console.log(
                    'Bulk tag:',
                    selectedRows.map((r) => r.original),
                  );
                }}
                className="h-8 text-xs"
                disabled
              >
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                Tag
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-8 w-8 p-0"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default People2Page;
