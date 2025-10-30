import { and, eq } from 'drizzle-orm';
import {
  Building2,
  Calendar,
  CheckSquare,
  Clock,
  Edit,
  FileText,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Twitter,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { db } from '~/db';
import { companiesTable } from '~/db/schema';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId, id: companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(organizationId, { id: userId });

  // Fetch the specific company with organization isolation
  const company = await db.query.companiesTable.findFirst({
    where: and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, organizationId)),
  });

  if (!company) {
    throw new Response('Company not found', { status: 404 });
  }

  return { userId, access_level, organizationId, company };
};

const tabs = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const CompanyPage = () => {
  const { company } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState('timeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();

  // Company sidebar content
  const CompanySidebar = () => (
    <div className="flex flex-col w-full">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hidden lg:flex shadow-s hover:bg-muted"
          onClick={() => navigate(-1)}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-auto p-4">
        {/* Avatar and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {company.name?.charAt(0) || 'C'}
          </div>
          <h2 className="text-lg font-semibold">{company.name || 'Unnamed Company'}</h2>
          <p className="text-sm text-muted-foreground">{company.industry || 'Company'}</p>
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Contact</h3>
            <div className="space-y-2">
              {company.domain && (
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-foreground">{company.domain}</p>
                  </div>
                </div>
              )}
              {company.phone && (
                <div className="flex items-start gap-2 text-sm">
                  <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{company.phone}</p>
                  </div>
                </div>
              )}
              {company.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{company.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Organization</h3>
            <div className="space-y-2">
              {company.website && (
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {company.website}
                    </a>
                  </div>
                </div>
              )}
              {company.industry && (
                <div className="flex items-start gap-2 text-sm">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {company.industry}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Social</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Edit className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {company.linkedin && (
                <div className="flex items-start gap-2 text-sm">
                  <Linkedin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={company.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>
              )}
              {company.twitter && (
                <div className="flex items-start gap-2 text-sm">
                  <Twitter className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={`https://twitter.com/${company.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {company.twitter}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Metadata</h3>
            </div>
            <div className="space-y-2 text-xs">
              {company.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(company.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {company.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(company.updatedAt).toLocaleDateString('en-US', {
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
      <div className="hidden lg:flex lg:min-w-72 lg:w-96 lg:border-r lg:border-border lg:bg-muted/30">
        <CompanySidebar />
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Company Details</SheetTitle>
          </SheetHeader>
          <CompanySidebar />
        </SheetContent>
      </Sheet>

      {/* Middle Panel - Timeline/Activity */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden items-center flex shadow-s"
              onClick={() => setSheetOpen(true)}
            >
              <Menu className="h-4 w-4" />
              <span className="text-xs">Details</span>
            </Button>
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {company.name?.charAt(0) || 'C'}
            </div>
            <h1 className="text-base font-semibold">{company.name || 'Unnamed Company'}</h1>
            <Badge variant="secondary" className="h-5 text-xs">
              Active
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Compose email
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">October 2025</div>
              <div className="space-y-3">
                {company.createdAt && (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
                        S
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{company.name || 'Company'}</span> was created
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(company.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {company.updatedAt && company.updatedAt !== company.createdAt && (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
                        S
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{company.name || 'Company'}</span> was updated
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(company.updatedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Tasks</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Task
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No tasks yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create first task
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Notes</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Note
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create first note
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Files</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <Paperclip className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No files yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Upload first file
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Email History</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Compose
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No emails yet</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Send first email
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Upcoming Meetings</h2>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Schedule
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No meetings scheduled</p>
                <Button variant="outline" size="sm" className="mt-4">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Schedule first meeting
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
