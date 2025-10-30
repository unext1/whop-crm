import type { ColumnDef } from '@tanstack/react-table';
import { and, eq, sql } from 'drizzle-orm';
import { Building2, CalendarIcon, Globe, MapPin, Phone, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { data, Form, Link, useActionData, useLoaderData, useNavigation } from 'react-router';
import { DataTable } from '~/components/data-table/data-table';
import { DataTableAdvancedToolbar } from '~/components/data-table/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '~/components/data-table/data-table-column-header';
import { DataTableFilterList } from '~/components/data-table/data-table-filter-list';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { db } from '~/db';
import { companiesTable, type CompanyType } from '~/db/schema';
import { useDataTable } from '~/hooks/use-data-table';
import { putToast } from '~/services/cookie.server';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import {
  buildOrderByClause,
  buildWhereClause,
  getColumnIds,
  getPaginationParams,
  parseDataTableSearchParams,
} from '~/utils/data-table.server';
import type { Route } from './+types';

const columns: ColumnDef<CompanyType>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Company Name" />,
    cell: ({ row }) => (
      <Link to={`${row.original.id}`} className="font-medium">
        {row.getValue('name') || 'N/A'}
      </Link>
    ),
    meta: {
      label: 'Company',
      placeholder: 'Search companies...',
      variant: 'text',
      icon: Building2,
    },
    enableColumnFilter: true,
  },
  {
    id: 'domain',
    accessorKey: 'domain',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Domain" />,
    cell: ({ row }) => {
      const domain = row.getValue('domain') as string;
      return domain ? (
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {domain}
        </a>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
    meta: {
      label: 'Domain',
      placeholder: 'Search domains...',
      variant: 'text',
      icon: Globe,
    },
    enableColumnFilter: true,
  },
  {
    id: 'industry',
    accessorKey: 'industry',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Industry" />,
    cell: ({ row }) => {
      const industry = row.getValue('industry') as string;
      return industry ? (
        <Badge variant="outline" className="capitalize">
          {industry}
        </Badge>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
    meta: {
      label: 'Industry',
      variant: 'select',
      options: [
        { label: 'Technology', value: 'Technology' },
        { label: 'Healthcare', value: 'Healthcare' },
        { label: 'Finance', value: 'Finance' },
        { label: 'Retail', value: 'Retail' },
        { label: 'Manufacturing', value: 'Manufacturing' },
        { label: 'Education', value: 'Education' },
        { label: 'Consulting', value: 'Consulting' },
        { label: 'Other', value: 'Other' },
      ],
      icon: Building2,
    },
    enableColumnFilter: true,
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Phone" />,
    cell: ({ row }) => {
      const phone = row.getValue('phone') as string;
      return phone ? (
        <div className="flex items-center">
          <Phone className="h-3 w-3 mr-1 text-muted-foreground" />
          {phone}
        </div>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
    meta: {
      label: 'Phone',
      placeholder: 'Search phone numbers...',
      variant: 'text',
      icon: Phone,
    },
    enableColumnFilter: true,
  },
  {
    id: 'address',
    accessorKey: 'address',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Address" />,
    cell: ({ row }) => {
      const address = row.getValue('address') as string;
      return address ? (
        <div className="flex items-center max-w-xs">
          <MapPin className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
          <span className="truncate">{address}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
    meta: {
      label: 'Address',
      placeholder: 'Search addresses...',
      variant: 'text',
      icon: MapPin,
    },
    enableColumnFilter: true,
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Created" />,
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as string;
      return date ? (
        <div className="text-sm text-muted-foreground">{new Date(date).toLocaleDateString()}</div>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      );
    },
    meta: {
      label: 'Created',
      variant: 'date',
      icon: CalendarIcon,
    },
    enableColumnFilter: true,
  },
];

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(companyId, { id: userId });

  // Parse data table state from URL
  const url = new URL(request.url);
  const columnIds = getColumnIds(columns);

  const { filters, sorting, joinOperator, page, perPage } = parseDataTableSearchParams<CompanyType>(
    url.searchParams,
    columnIds,
  );

  // Map column IDs to Drizzle columns
  const columnMap = {
    name: companiesTable.name,
    domain: companiesTable.domain,
    industry: companiesTable.industry,
    phone: companiesTable.phone,
    address: companiesTable.address,
    createdAt: companiesTable.createdAt,
  };

  // Build query conditions
  const filterWhere = buildWhereClause(filters, joinOperator, columnMap);
  const orderBy = buildOrderByClause(sorting, columnMap);
  const { offset, limit } = getPaginationParams(page, perPage);

  // Combine with base condition
  const baseWhere = eq(companiesTable.organizationId, companyId);
  const where = filterWhere ? and(baseWhere, filterWhere) : baseWhere;

  // Fetch data
  const companies = await db
    .select()
    .from(companiesTable)
    .where(where)
    .orderBy(...(orderBy.length > 0 ? orderBy : [companiesTable.createdAt]))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(companiesTable).where(where);

  return {
    userId,
    access_level,
    companyId,
    companies,
    pageCount: Math.ceil(Number(count) / perPage),
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createCompany') {
    const name = formData.get('name')?.toString();
    const description = formData.get('description')?.toString();
    const domain = formData.get('domain')?.toString();
    const website = formData.get('website')?.toString();
    const industry = formData.get('industry')?.toString();
    const address = formData.get('address')?.toString();
    const phone = formData.get('phone')?.toString();
    const linkedin = formData.get('linkedin')?.toString();
    const twitter = formData.get('twitter')?.toString();

    if (!name) {
      const headers = await putToast({
        title: 'Error',
        message: 'Company name is required',
        variant: 'destructive',
      });
      return data({ error: 'Company name is required', close: false }, { headers, status: 400 });
    }

    try {
      await db.insert(companiesTable).values({
        name,
        description,
        domain,
        website,
        industry,
        address,
        phone,
        linkedin,
        twitter,
        organizationId: params.companyId,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Company created successfully',
        variant: 'default',
      });

      return data({ error: null, close: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create company',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create company', close: false }, { headers, status: 500 });
    }
  }

  const headers = await putToast({
    title: 'Success',
    message: 'Operation completed',
    variant: 'default',
  });

  return data({ error: null, close: true }, { headers });
};

const DashboardPage = () => {
  const {
    userId: _userId,
    access_level: _access_level,
    companyId: _companyId,
    companies,
    pageCount,
  } = useLoaderData<typeof loader>();

  const { table } = useDataTable({
    data: companies,
    columns,
    pageCount,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    getRowId: (row) => row.id,
    shallow: false, // Important: Set to false to trigger React Router navigation and loader revalidation
  });

  const actionData = useActionData<typeof action>();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (actionData?.close) {
      setOpen(false);
    }
  }, [actionData]);

  const navigation = useNavigation();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Companies</h1>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Company</DialogTitle>
              </DialogHeader>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="createCompany" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input id="name" name="name" placeholder="Enter company name" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input id="domain" name="domain" placeholder="company.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Brief description of the company"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select name="industry">
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Consulting">Consulting</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" name="website" placeholder="https://company.com" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="+1 (555) 123-4567" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" placeholder="123 Main St, City, State" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input id="linkedin" name="linkedin" placeholder="https://linkedin.com/company/..." />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input id="twitter" name="twitter" placeholder="@companyhandle" />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogTrigger>
                  <Button type="submit">Create Company</Button>
                </div>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        <DataTable table={table} loading={navigation.state === 'loading'}>
          <DataTableAdvancedToolbar table={table}>
            <DataTableFilterList table={table} shallow={false} />
          </DataTableAdvancedToolbar>
        </DataTable>
      </div>
    </div>
  );
};

export default DashboardPage;
