import { eq } from 'drizzle-orm';
import { Bell, Globe, Mail, Palette, Settings as SettingsIcon, Shield, User, Users } from 'lucide-react';
import { useState } from 'react';
import { data, useNavigate } from 'react-router';
import { EditableField } from '~/components/editable-field';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/settings';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);

  // Fetch organization details
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, organizationId),
  });

  // Fetch all users in the organization (team members)
  const teamMembers = await db.query.userTable.findMany({
    where: eq(userTable.organizationId, organizationId),
    orderBy: userTable.name,
  });

  if (!organization) {
    throw new Response('Organization not found', { status: 404 });
  }

  return {
    user,
    organizationId,
    organization,
    teamMembers,
  };
};

export const action = async ({ params, request }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);
  const userId = user.id;

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'updateOrganizationField') {
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!fieldName) {
      return data({ error: 'Field name required' }, { status: 400 });
    }

    const allowedFields = ['name'];
    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    try {
      await db
        .update(organizationTable)
        .set({ [fieldName]: fieldValue || null })
        .where(eq(organizationTable.id, organizationId));

      // TODO: Add organization activity logging if needed

      const headers = await putToast({
        title: 'Success',
        message: 'Organization updated successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update organization',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update organization' }, { headers, status: 500 });
    }
  }

  if (intent === 'updateUserField') {
    const fieldName = formData.get('fieldName')?.toString();
    const fieldValue = formData.get('fieldValue')?.toString();

    if (!fieldName) {
      return data({ error: 'Field name required' }, { status: 400 });
    }

    const allowedFields = ['name', 'lastName'];
    if (!allowedFields.includes(fieldName)) {
      return data({ error: 'Invalid field' }, { status: 400 });
    }

    try {
      await db
        .update(userTable)
        .set({ [fieldName]: fieldValue || null })
        .where(eq(userTable.id, userId));

      const headers = await putToast({
        title: 'Success',
        message: 'Profile updated successfully',
        variant: 'default',
      });

      return data({ success: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to update profile',
        variant: 'destructive',
      });
      return data({ error: 'Failed to update profile' }, { headers, status: 500 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};

const tabs = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'team', label: 'Team', icon: Users },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const SettingsPage = ({ loaderData }: Route.ComponentProps) => {
  const { organization, organizationId, teamMembers, user } = loaderData;
  const [activeTab, setActiveTab] = useState('general');
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            <SettingsIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Settings</h1>
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
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-8">
          {activeTab === 'general' && (
            <div>
              {/* Organization Settings */}
              <Card className="p-8 space-y-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Organization Settings</h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your organization's basic information and preferences
                    </p>
                  </div>
                </div>

                <div className="">
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4" />
                        Organization Name
                      </Label>
                      <EditableField
                        value={organization.name}
                        fieldName="fieldValue"
                        intent="updateOrganizationField"
                        fieldNameParam="name"
                        placeholder="Enter organization name..."
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        This name appears throughout your workspace and is visible to team members.
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4" />
                        Workspace Preferences
                      </Label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div>
                            <div className="text-sm font-medium">Public Workspace</div>
                            <div className="text-xs text-muted-foreground">
                              Allow external sharing of workspace content
                            </div>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div>
                            <div className="text-sm font-medium">Email Notifications</div>
                            <div className="text-xs text-muted-foreground">
                              Send email updates for important activities
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 mt-6">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Bell className="h-4 w-4" />
                        Subscription & Billing
                      </Label>
                      <Card className="p-4 bg-linear-to-r from-primary/5 to-primary/10 border-primary/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium capitalize">{organization.plan || 'Free'} Plan</div>
                            <div className="text-xs text-muted-foreground">
                              {organization.plan === 'premium'
                                ? 'Full access to all features'
                                : 'Basic features included'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={organization.plan === 'premium' ? 'default' : 'secondary'}>
                              {organization.plan === 'premium' ? 'Premium' : 'Free'}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-4"
                          onClick={() => navigate(`/dashboard/${organizationId}/billing`)}
                        >
                          Manage Billing & Plan
                        </Button>
                      </Card>
                    </div>

                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Palette className="h-4 w-4" />
                        Appearance
                      </Label>
                      <Card className="p-4">
                        <div className="text-sm text-muted-foreground text-center py-4">
                          Theme and appearance settings coming soon
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-8">
              {/* Profile Header */}
              <Card className="p-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.profilePictureUrl || ''} alt="Profile" />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {user.name?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-1">
                      {user.name || user.username || 'User'}
                      {user.lastName && ` ${user.lastName}`}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-3">{user.email}</p>
                    <div className="flex items-center gap-2">
                      {user.id === organization.ownerId && (
                        <Badge variant="default" className="text-xs">
                          Whop Owner
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Personal Information */}
              <Card className="p-8 space-y-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Personal Information</h2>
                    <p className="text-sm text-muted-foreground">
                      Update your personal details and contact information
                    </p>
                  </div>
                </div>

                <div className="">
                  <div className="space-y-6 mb-6">
                    <div>
                      <Label className="text-sm font-medium mb-3">Basic Information</Label>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="firstName" className="text-xs text-muted-foreground mb-1 block">
                            First Name
                          </Label>
                          <EditableField
                            value={user.name}
                            fieldName="fieldValue"
                            intent="updateUserField"
                            fieldNameParam="name"
                            placeholder="Enter your first name..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName" className="text-xs text-muted-foreground mb-1 block">
                            Last Name
                          </Label>
                          <EditableField
                            value={user.lastName}
                            fieldName="fieldValue"
                            intent="updateUserField"
                            fieldNameParam="lastName"
                            placeholder="Enter your last name..."
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium mb-3">Account Preferences</Label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div>
                            <div className="text-sm font-medium">Email Notifications</div>
                            <div className="text-xs text-muted-foreground">
                              Receive notifications about your tasks and updates
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div>
                            <div className="text-sm font-medium">Desktop Notifications</div>
                            <div className="text-xs text-muted-foreground">
                              Show browser notifications for important events
                            </div>
                          </div>
                          <Switch />
                        </div>
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div>
                            <div className="text-sm font-medium">Weekly Summary</div>
                            <div className="text-xs text-muted-foreground">
                              Receive a weekly summary of your activity
                            </div>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Mail className="h-4 w-4" />
                        Contact Information
                      </Label>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Email Address</Label>
                          <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{user.email}</span>
                            <Badge variant="secondary" className="text-xs">
                              Primary
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Email is managed through your Whop account and cannot be changed here.
                          </p>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Whop Username</Label>
                          <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
                            <Badge variant="outline" className="text-xs">
                              Whop Account
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Your username is managed through your Whop account.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-8">
              {/* Team Management */}
              <Card className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Team Management</h2>
                      <p className="text-sm text-muted-foreground">Manage team members and their access levels</p>
                    </div>
                  </div>
                  <Button variant="outline">
                    <User className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </div>

                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <Card key={member.id} className="p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.profilePictureUrl || ''} alt="Avatar" />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {member.name?.charAt(0) || member.username?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">
                                {member.name || member.username || 'Unknown User'}
                                {member.lastName && ` ${member.lastName}`}
                              </p>
                              {member.id === user.id && (
                                <Badge variant="secondary" className="text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={member.id === organization.ownerId ? 'default' : 'outline'}
                                className="text-xs"
                              >
                                {member.id === organization.ownerId ? 'Owner' : 'Member'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.id !== user.id && (
                            <Button variant="ghost" size="sm">
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {teamMembers.length === 0 && (
                    <Card className="p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No team members yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Invite your first team member to start collaborating
                      </p>
                      <Button>
                        <User className="h-4 w-4 mr-2" />
                        Invite Team Member
                      </Button>
                    </Card>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
