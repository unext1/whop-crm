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
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { db } from '~/db';
import { peopleTable } from '~/db/schema';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId, id: personId } = params;
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(organizationId, { id: userId });

  // Fetch the specific person with organization isolation and company relations
  const person = await db.query.peopleTable.findFirst({
    where: and(eq(peopleTable.id, personId), eq(peopleTable.organizationId, organizationId)),
    with: {
      companiesPeople: {
        with: {
          company: true,
        },
      },
    },
  });

  if (!person) {
    throw new Response('Person not found', { status: 404 });
  }

  return { userId, access_level, organizationId, person };
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

const PersonPage = () => {
  const { person } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState('timeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();

  // Person sidebar content
  const PersonSidebar = () => (
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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-auto p-4">
        {/* Avatar and Name */}
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {person.name?.charAt(0) || 'P'}
          </div>
          <h2 className="text-lg font-semibold">{person.name || 'Unnamed Person'}</h2>
          {person.jobTitle && <p className="text-sm text-muted-foreground">{person.jobTitle}</p>}
        </div>

        {/* Details Section */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Contact</h3>
            <div className="space-y-2">
              {person.phone && (
                <div className="flex items-start gap-2 text-sm">
                  <Phone className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{person.phone}</p>
                  </div>
                </div>
              )}
              {person.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-foreground">{person.address}</p>
                  </div>
                </div>
              )}
              {person.website && (
                <div className="flex items-start gap-2 text-sm">
                  <Globe className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={person.website.startsWith('http') ? person.website : `https://${person.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {person.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Companies</h3>
            <div className="space-y-2">
              {person.companiesPeople.length > 0 ? (
                person.companiesPeople.map((cp) => (
                  <div key={cp.company.id} className="flex items-start gap-2 text-sm">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-foreground">{cp.company.name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No company assigned</p>
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
              {person.linkedin && (
                <div className="flex items-start gap-2 text-sm">
                  <Linkedin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>
              )}
              {person.twitter && (
                <div className="flex items-start gap-2 text-sm">
                  <Twitter className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <a
                      href={`https://twitter.com/${person.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary truncate"
                    >
                      {person.twitter}
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
              {person.createdAt && (
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="text-foreground">
                    {new Date(person.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {person.updatedAt && (
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="text-foreground">
                    {new Date(person.updatedAt).toLocaleDateString('en-US', {
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
        <PersonSidebar />
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-3/4 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Person Details</SheetTitle>
          </SheetHeader>
          <PersonSidebar />
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
              {person.name?.charAt(0) || 'P'}
            </div>
            <h1 className="text-base font-semibold">{person.name || 'Unnamed Person'}</h1>
            {person.jobTitle && (
              <Badge variant="secondary" className="h-5 text-xs">
                {person.jobTitle}
              </Badge>
            )}
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
        <div className="flex-1 overflow-auto p-4 scrollbar-thin">
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                {person.createdAt
                  ? new Date(person.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                  : 'Recent'}
              </div>
              <div className="space-y-3">
                {person.createdAt && (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
                        P
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{person.name || 'Person'}</span> was created
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(person.createdAt).toLocaleDateString('en-US', {
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

                {person.updatedAt && person.updatedAt !== person.createdAt && (
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold">
                        P
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{person.name || 'Person'}</span> was updated
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(person.updatedAt).toLocaleDateString('en-US', {
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
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
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
              {person.notes ? (
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <p className="text-sm whitespace-pre-wrap">{person.notes}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No notes yet</p>
                  <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first note
                  </Button>
                </div>
              )}
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
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
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
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
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
                <Button variant="outline" size="sm" className="mt-4 h-8 text-xs">
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

export default PersonPage;
