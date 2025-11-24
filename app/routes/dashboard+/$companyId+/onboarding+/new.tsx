import { createSdk } from '@whop/iframe';
import { and, eq } from 'drizzle-orm';
import { ArrowDown, ArrowUp, ChartArea, Check, CheckSquare, LayoutDashboardIcon, TrendingUp, User } from 'lucide-react';
import { useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigate, useNavigation, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { ChartConfig } from '~/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { db } from '~/db';
import { boardColumnTable, boardTable, boardTaskTable } from '~/db/kanban-schemas';
import {
  companiesPeopleTable,
  companiesTable,
  emailsTable,
  organizationTable,
  peopleEmailsTable,
  peopleTable,
  userTable,
} from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { putToast } from '~/services/cookie.server';
import { env } from '~/services/env.server';
import {
  getAuthorizedUserId,
  getPublicUser,
  getWhopCompanyMembers,
  hasAccess,
  hasOrganizationPremiumAccess,
  verifyWhopToken,
  whopSdk,
} from '~/services/whop.server';
import { logPersonActivity, logTaskActivity } from '~/utils/activity.server';
import type { Route } from './+types/new';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);

  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  const whopCompany = await whopSdk.companies.retrieve(companyId);
  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists for this specific organization
  const existingUser = await db
    .select()
    .from(userTable)
    .where(and(eq(userTable.whopUserId, userId), eq(userTable.organizationId, companyId)))
    .limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // Check if organization already has premium access
  const hasPremiumAccess = hasOrg ? await hasOrganizationPremiumAccess(companyId) : false;

  // Determine starting step based on what exists
  let initialStep = 1;
  if (hasOrg && !hasUser) {
    initialStep = 2; // Skip org creation, go to user profile
  } else if (hasOrg && hasUser) {
    // Check if trial is active
    const org = existingOrg[0];
    const hasActiveTrial = org?.trialEnd
      ? new Date(org.trialEnd) > new Date() && new Date(org.trialStart || '') <= new Date()
      : false;

    // Check if trial has expired - redirect to trial page
    if (org?.trialEnd && !hasActiveTrial) {
      const trialEndDate = new Date(org.trialEnd);
      const now = new Date();
      if (now > trialEndDate) {
        // Trial expired, redirect to trial page
        throw redirect(href('/dashboard/:companyId/onboarding/trial', { companyId }));
      }
    }

    if (hasPremiumAccess || hasActiveTrial) {
      // Check if user has completed setup (has data or skipped)
      const hasPeople = await db.select().from(peopleTable).where(eq(peopleTable.organizationId, companyId)).limit(1);
      const hasCompanies = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.organizationId, companyId))
        .limit(1);

      // If no data exists, show step 4
      if (hasPeople.length === 0 && hasCompanies.length === 0) {
        initialStep = 4;
      } else {
        // Has data, onboarding complete
        throw redirect(href('/dashboard/:companyId', { companyId }));
      }
    } else {
      // No premium access yet, show payment step
      initialStep = 3;
    }
  }

  const monthlyCheckout = await createCheckoutSession(env.WHOP_MONTHLY_PLAN_ID, companyId);
  const annualCheckout = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

  // Load Whop members for preview (only if user has access)
  let whopMembers: Array<{
    id: string;
    user: {
      id: string;
      name?: string | null;
      username?: string | null;
      email?: string | null;
    } | null;
    phone?: string | null;
  }> = [];
  try {
    const isAdmin = await hasAccess({ request, companyId });
    if (isAdmin) {
      const allPeople = await db.query.peopleTable.findMany({
        where: eq(peopleTable.organizationId, companyId),
      });
      const allWhopCompanyMembers = await getWhopCompanyMembers({ request, companyId });
      // Filter out members without email or already imported
      whopMembers = allWhopCompanyMembers.filter(
        (member) => member.user?.email && !allPeople.some((p) => p.whopUserId === member.id),
      );
    }
  } catch {
    // If we can't load members, just continue with empty array
    whopMembers = [];
  }

  return {
    whopUser: {
      id: authorizedUser.id,
      username: authorizedUser.user.username || null,
      name: authorizedUser.user.name,
      email: authorizedUser.user.email,
    },
    initialStep,
    hasOrg,
    hasUser,
    hasPremiumAccess,
    monthlyCheckout,
    annualCheckout,
    whopAppId: env.WHOP_APP_ID,
    whopCompany,
    whopMembers,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  const publicWhopUser = await getPublicUser(userId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'createOrg') {
    const name = formData.get('name')?.toString();
    const teamSize = formData.get('teamSize')?.toString();

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    if (!teamSize) {
      return data({ error: 'Team size is required', step: 1 } as const, { status: 400 });
    }

    const org = await db
      .insert(organizationTable)
      .values({
        id: companyId,
        name: name.trim(),
      })
      .returning();

    const newBoard = await db
      .insert(boardTable)
      .values({
        name: 'Pipeline',
        type: 'pipeline',
        companyId: org[0].id,
      })
      .returning();

    await db.insert(boardColumnTable).values([
      { name: '👋 Lead', order: 1, boardId: newBoard[0].id },
      { name: '👍 Qualified', order: 2, boardId: newBoard[0].id },
      { name: '💡 Proposal', order: 3, boardId: newBoard[0].id },
      { name: '💬 Negotiation', order: 4, boardId: newBoard[0].id },
      { name: '🎉 Won', order: 5, boardId: newBoard[0].id },
    ]);

    return data({ success: true, step: 1, message: 'Organization created' } as const);
  }

  if (intent === 'createUser') {
    const firstName = formData.get('firstName')?.toString();

    const lastName = formData.get('lastName')?.toString();

    if (!firstName || !lastName) {
      return data({ error: 'First name and last name are required', step: 2 } as const, { status: 400 });
    }

    const [createdUser] = await db
      .insert(userTable)
      .values({
        email: authorizedUser.user.email || 'user@example.com',
        name: firstName.trim(),
        lastName: lastName.trim(),
        whopUserId: userId,
        organizationId: companyId,
        profilePictureUrl: publicWhopUser.profile_picture?.url || null,
      })
      .returning();

    await db.update(organizationTable).set({ ownerId: createdUser.id }).where(eq(organizationTable.id, companyId));

    const org = await db.query.organizationTable.findFirst({
      where: eq(organizationTable.id, companyId),
    });

    await db.update(boardTable).set({ ownerId: createdUser.id }).where(eq(boardTable.companyId, companyId));
    if (!org?.ownerId) {
      await db.update(organizationTable).set({ ownerId: createdUser.id }).where(eq(organizationTable.id, companyId));
      // Update the default board to set the owner
      await db.update(boardTable).set({ ownerId: createdUser.id }).where(eq(boardTable.companyId, companyId));
    }

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'startTrial') {
    // Check if organization already has premium access
    const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);

    // If they already have premium, redirect to step 4
    if (hasPremiumAccess) {
      return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
    }

    // Start 3-day trial (no credit card required)
    const org = await db.query.organizationTable.findFirst({
      where: eq(organizationTable.id, companyId),
    });

    if (!org) {
      return data({ error: 'Organization not found', step: 3 } as const, { status: 404 });
    }

    // Check if trial already exists and is still active
    if (org.trialEnd) {
      const trialEndDate = new Date(org.trialEnd);
      const now = new Date();
      if (now <= trialEndDate) {
        // Trial is still active, redirect to step 4
        return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
      }
      if (now > trialEndDate) {
        // Trial expired, redirect to trial page
        throw redirect(href('/dashboard/:companyId/onboarding/trial', { companyId }));
      }
    }

    // Start new trial
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 3); // 3 days from now

    await db
      .update(organizationTable)
      .set({
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString(),
      })
      .where(eq(organizationTable.id, companyId));

    // Redirect to step 4 (setup data)
    return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
  }

  if (intent === 'processPayment') {
    const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);

    if (hasPremiumAccess) {
      // Redirect to step 4 (setup data)
      return redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
    }

    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Please select a valid plan', step: 3 } as const, { status: 400 });
    }

    // Get the appropriate checkout session
    const planId = selectedPlan === 'monthly' ? env.WHOP_MONTHLY_PLAN_ID : env.WHOP_ANNUAL_PLAN_ID;
    const checkoutSession = await createCheckoutSession(planId, companyId);

    if (!checkoutSession) {
      return data({ error: 'Failed to create checkout session', step: 3 } as const, { status: 500 });
    }

    // Return checkout session data for client-side payment processing
    return data({
      success: true,
      step: 3,
      selectedPlan,
      checkoutSession,
      message: `Processing ${selectedPlan} payment`,
    } as const);
  }

  if (intent === 'loadDemoData') {
    try {
      // Get the database user ID (not the Whop authorized user ID)
      const dbUser = await db.query.userTable.findFirst({
        where: and(eq(userTable.whopUserId, userId), eq(userTable.organizationId, companyId)),
      });

      if (!dbUser) {
        return data({ error: 'User not found in database', step: 4 } as const, { status: 404 });
      }

      const pipelineBoard = await db.query.boardTable.findFirst({
        where: and(eq(boardTable.companyId, companyId), eq(boardTable.type, 'pipeline')),
        with: {
          columns: {
            orderBy: (columns, { asc }) => [asc(columns.order)],
          },
        },
      });

      if (!pipelineBoard || !pipelineBoard.columns.length) {
        return data({ error: 'Pipeline board not found', step: 4 } as const, { status: 500 });
      }

      const columns = pipelineBoard.columns;

      await db.transaction(async (tx) => {
        // Create demo companies
        const demoCompanies = [
          { name: 'TechCorp Solutions', industry: 'Technology', domain: 'techcorp.com' },
          { name: 'Global Marketing Inc', industry: 'Marketing', domain: 'globalmarketing.com' },
        ];

        const createdCompanies = await Promise.all(
          demoCompanies.map((company) =>
            tx
              .insert(companiesTable)
              .values({
                name: company.name,
                industry: company.industry,
                domain: company.domain,
                website: `https://${company.domain}`,
                organizationId: companyId,
              })
              .returning(),
          ),
        );

        // Create demo people
        const demoPeople = [
          {
            name: 'Sarah Johnson',
            jobTitle: 'VP of Sales',
            email: 'sarah.johnson@techcorp.com',
            phone: '+1 (555) 123-4567',
            companyName: 'TechCorp Solutions',
          },
          {
            name: 'Michael Chen',
            jobTitle: 'CEO',
            email: 'michael.chen@techcorp.com',
            phone: '+1 (555) 234-5678',
            companyName: 'TechCorp Solutions',
          },
          {
            name: 'Emily Rodriguez',
            jobTitle: 'Marketing Director',
            email: 'emily@globalmarketing.com',
            phone: '+1 (555) 345-6789',
            companyName: 'Global Marketing Inc',
          },
          {
            name: 'David Kim',
            jobTitle: 'Product Manager',
            email: 'david.kim@techcorp.com',
            phone: '+1 (555) 456-7890',
            companyName: 'TechCorp Solutions',
          },
          {
            name: 'Lisa Anderson',
            jobTitle: 'Account Executive',
            email: 'lisa@globalmarketing.com',
            phone: '+1 (555) 567-8901',
            companyName: 'Global Marketing Inc',
          },
        ];

        const createdPeople = await Promise.all(
          demoPeople.map(async (person) => {
            const company = createdCompanies.find((c) => c[0].name === person.companyName);

            const [newPerson] = await tx
              .insert(peopleTable)
              .values({
                name: person.name,
                jobTitle: person.jobTitle,
                phone: person.phone,
                organizationId: companyId,
              })
              .returning();

            // Create email
            const [newEmail] = await tx
              .insert(emailsTable)
              .values({
                email: person.email,
                type: 'work',
                isPrimary: true,
                organizationId: companyId,
              })
              .returning();

            await tx.insert(peopleEmailsTable).values({
              personId: newPerson.id,
              emailId: newEmail.id,
            });

            // Link to company if exists
            if (company) {
              await tx.insert(companiesPeopleTable).values({
                companyId: company[0].id,
                personId: newPerson.id,
              });
            }

            // Log activity
            await logPersonActivity({
              personId: newPerson.id,
              userId: dbUser.id,
              activityType: 'created',
              description: 'Added to CRM',
              tx,
            });

            return { person: newPerson, company };
          }),
        );

        // Create demo deals in pipeline
        const demoDeals = [
          {
            name: 'Enterprise Software License',
            amount: 45000,
            columnIndex: 0, // Lead
            personId: createdPeople[0].person.id,
            companyId: createdPeople[0].company?.[0].id,
            content: 'Large enterprise looking for annual license. High priority.',
          },
          {
            name: 'Marketing Campaign Q1',
            amount: 12000,
            columnIndex: 1, // Qualified
            personId: createdPeople[2].person.id,
            companyId: createdPeople[2].company?.[0].id,
            content: 'Qualified lead for Q1 marketing campaign. Follow up scheduled.',
          },
          {
            name: 'Product Integration',
            amount: 32000,
            columnIndex: 2, // Proposal
            personId: createdPeople[1].person.id,
            companyId: createdPeople[1].company?.[0].id,
            content: 'Proposal sent. Waiting for technical review.',
          },
        ];

        await Promise.all(
          demoDeals.map(async (deal, index) => {
            const column = columns[deal.columnIndex] || columns[0];

            const maxOrderTask = await tx.query.boardTaskTable.findFirst({
              where: eq(boardTaskTable.columnId, column.id),
              orderBy: (tasks, { desc }) => [desc(tasks.order)],
            });
            const nextOrder = maxOrderTask?.order ? maxOrderTask.order + 1 : index + 1;

            const [task] = await tx
              .insert(boardTaskTable)
              .values({
                columnId: column.id,
                boardId: pipelineBoard.id,
                name: deal.name,
                order: nextOrder,
                type: 'pipeline',
                status: 'open',
                amount: deal.amount,
                personId: deal.personId,
                companyId: deal.companyId,
                content: deal.content,
                ownerId: dbUser.id,
              })
              .returning();

            await logTaskActivity({
              taskId: task.id,
              userId: dbUser.id,
              activityType: 'created',
              description: `Deal "${deal.name}" was created`,
              tx,
            });

            if (deal.personId) {
              await logPersonActivity({
                personId: deal.personId,
                userId: dbUser.id,
                activityType: 'task_created',
                description: `Created deal "${deal.name}"`,
                relatedEntityId: task.id,
                relatedEntityType: 'task',
                tx,
              });
            }
          }),
        );
      });

      const headers = await putToast({
        title: 'Demo data loaded! 🎉',
        message: 'Your workspace is ready with sample data',
        variant: 'default',
      });

      return redirect(href('/dashboard/:companyId', { companyId }), { headers });
    } catch {
      return data({ error: 'Failed to load demo data', step: 4 } as const, { status: 500 });
    }
  }

  if (intent === 'importAllWhopMembers') {
    try {
      const allPeople = await db.query.peopleTable.findMany({
        where: eq(peopleTable.organizationId, companyId),
      });
      const allWhopCompanyMembers = await getWhopCompanyMembers({ request, companyId });

      // Filter out members without user or user.email, and those already imported
      const validMembers = allWhopCompanyMembers.filter(
        (member) => member.user?.email && !allPeople.some((p) => p.whopUserId === member.id),
      );

      if (validMembers.length === 0) {
        const headers = await putToast({
          title: 'No members to import',
          message: 'All Whop members are already imported or have no email addresses',
          variant: 'default',
        });
        return redirect(href('/dashboard/:companyId', { companyId }), { headers });
      }

      await db.transaction(async (tx) => {
        await Promise.all(
          validMembers.map(async (member) => {
            // Create the person
            const [newPerson] = await tx
              .insert(peopleTable)
              .values({
                name: member.user?.name || member.user?.username || 'Unknown',
                organizationId: companyId,
                phone: member.phone || undefined,
                whopUserId: member.id,
                whopUserName: member.user?.username || undefined,
              })
              .returning();

            // Create email if member has one
            if (member.user?.email) {
              const [newEmail] = await tx
                .insert(emailsTable)
                .values({
                  email: member.user.email,
                  type: 'work',
                  isPrimary: true,
                  organizationId: companyId,
                })
                .returning();

              // Link person to email
              await tx.insert(peopleEmailsTable).values({
                personId: newPerson.id,
                emailId: newEmail.id,
              });
            }

            // Log activity for imported person
            await logPersonActivity({
              personId: newPerson.id,
              userId: authorizedUser.id,
              activityType: 'created',
              description: 'Imported from Whop',
              tx,
            });
          }),
        );
      });

      const headers = await putToast({
        title: 'Members imported! 🎉',
        message: `Successfully imported ${validMembers.length} ${validMembers.length === 1 ? 'member' : 'members'}`,
        variant: 'default',
      });

      return redirect(href('/dashboard/:companyId', { companyId }), { headers });
    } catch {
      return data({ error: 'Failed to import members', step: 4 } as const, { status: 500 });
    }
  }

  if (intent === 'skipSetup') {
    const headers = await putToast({
      title: 'Welcome! 🎉',
      message: 'Your workspace is ready. Start adding your data!',
      variant: 'default',
    });
    return redirect(href('/dashboard/:companyId', { companyId }), { headers });
  }

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

const chartConfig = {
  people: {
    label: 'People',
    color: 'hsl(var(--chart-1))',
  },
  companies: {
    label: 'Companies',
    color: 'hsl(var(--chart-2))',
  },
  tasks: {
    label: 'Tasks',
    color: 'hsl(var(--chart-3))',
  },
  deals: {
    label: 'Deals',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

const DashboardMockup = ({ orgName, userName }: { orgName: string; userName: string }) => {
  const statsCards = [
    {
      title: 'People',
      value: 47,
      growth: 12,
      icon: User,
      last30Days: 5,
      positive: true,
    },
    {
      title: 'Tasks',
      value: 156,
      growth: 15,
      icon: CheckSquare,
      last30Days: 23,
      positive: true,
    },
    {
      title: 'Deals',
      value: 12,
      growth: 25,
      icon: TrendingUp,
      last30Days: 4,
      positive: true,
    },
  ];

  const chartData = [
    { month: 'Jan 2024', people: 10, companies: 5, tasks: 20, deals: 2 },
    { month: 'Feb 2024', people: 15, companies: 8, tasks: 35, deals: 4 },
    { month: 'Mar 2024', people: 20, companies: 12, tasks: 50, deals: 5 },
    { month: 'Apr 2024', people: 25, companies: 15, tasks: 70, deals: 6 },
    { month: 'May 2024', people: 30, companies: 18, tasks: 90, deals: 7 },
    { month: 'Jun 2024', people: 35, companies: 20, tasks: 110, deals: 8 },
    { month: 'Jul 2024', people: 38, companies: 21, tasks: 125, deals: 9 },
    { month: 'Aug 2024', people: 40, companies: 22, tasks: 135, deals: 10 },
    { month: 'Sep 2024', people: 42, companies: 22, tasks: 145, deals: 11 },
    { month: 'Oct 2024', people: 44, companies: 23, tasks: 150, deals: 11 },
    { month: 'Nov 2024', people: 46, companies: 23, tasks: 154, deals: 12 },
    { month: 'Dec 2024', people: 47, companies: 23, tasks: 156, deals: 12 },
  ];

  return (
    <div className="overflow-hidden w-full max-w-4xl">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            <LayoutDashboardIcon className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">{orgName}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold">Welcome back, {userName} 👋</h2>
          <p className="text-base text-muted-foreground">Here's a quick overview of your activity this month.</p>
        </div>
        <div className=" space-y-4">
          {/* Statistics Cards - 4 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              const hasGrowth = Math.abs(stat.growth) > 0;
              return (
                <Card
                  key={stat.title}
                  className="bg-linear-to-b from-muted to-muted/30 shadow col-span-1 border transition-all duration-300 transform"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      {hasGrowth && (
                        <Badge variant={stat.positive ? 'default' : 'destructive'} className="text-xs gap-1 shadow-s">
                          {stat.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(stat.growth)}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xl flex items-center gap-2 font-bold tracking-tight">
                        {formatNumber(stat.value)}{' '}
                        <span className="text-sm font-normal text-muted-foreground">{stat.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +
                        {formatNumber(
                          stat.title === 'People'
                            ? statsCards[0].last30Days
                            : stat.title === 'Companies'
                              ? statsCards[1].last30Days
                              : stat.title === 'Tasks'
                                ? statsCards[2].last30Days
                                : 0,
                        )}{' '}
                        this month
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Growth Chart */}
          <Card className="bg-muted/30 shadow-sm col-span-4">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Growth Overview</CardTitle>
                  <p className="text-sm text-muted-foreground">12-month trend across all metrics</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                  }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <defs>
                    <linearGradient id="fillPeople" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillCompanies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="deals"
                    type="natural"
                    fill="url(#fillDeals)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-4))"
                    stackId="a"
                  />
                  <Area
                    dataKey="tasks"
                    type="natural"
                    fill="url(#fillTasks)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-3))"
                    stackId="a"
                  />
                  <Area
                    dataKey="companies"
                    type="natural"
                    fill="url(#fillCompanies)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-2))"
                    stackId="a"
                  />
                  <Area
                    dataKey="people"
                    type="natural"
                    fill="url(#fillPeople)"
                    fillOpacity={0.4}
                    stroke="hsl(var(--chart-1))"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const TaskDetailMockup = () => (
  <div className="flex flex-col overflow-hidden w-full max-w-4xl">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">People</h1>
        <Badge variant="secondary" className="h-5 text-xs font-normal">
          3
        </Badge>
      </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-auto p-4 scrollbar-thin">
      <div className="rounded-md border border-border overflow-x-scroll">
        {/* Table Header */}
        <div className="border-b border-border bg-muted/30">
          <div className="grid grid-cols-3 gap-3 px-4 py-3 text-xs font-medium text-muted-foreground">
            <div>Person</div>
            <div>Emails</div>
            <div>Phone</div>
          </div>
        </div>

        {/* Table Rows - Only 3 rows to fit better */}
        <div className="divide-y divide-border">
          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                SJ
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">Sarah</span>
                </div>
                <span className="text-xs text-muted-foreground">Sales</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              sarah@company.com
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="truncate">+1 (555) 123-4567</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                MR
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm">Mike</span>
                <span className="text-xs text-muted-foreground">CTO</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              mike@company.com
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span>+1 (555) 987-6543</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                AC
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm">Alex </span>
                  <Badge variant="outline" className="h-4 text-[10px] px-2 mt-0.5 bg-primary">
                    Whop
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">VP Marketing</span>
              </div>
            </div>
            <div className="flex gap-1.5 text-xs items-center">
              <span className="mr-1">✉️</span>
              alex@company.com
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SalesFeaturesMockup = () => (
  <div className="w-full max-w-2xl space-y-6">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          <ChartArea className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">Sales Pipeline</h1>
      </div>
    </div>

    {/* Kanban Board */}
    <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
      {/* Lead Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Lead</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">3</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">Global Solutions Inc</div>
              <div className="text-sm font-semibold">$45K</div>
            </div>
            <div className="text-xs text-muted-foreground">Enterprise software</div>
          </div>
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">TechStart Ltd</div>
              <div className="text-sm font-semibold">$12K</div>
            </div>
            <div className="text-xs text-muted-foreground">SaaS platform</div>
          </div>
        </div>
      </div>

      {/* Qualified Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Qualified</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">2</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">DataFlow Corp</div>
              <div className="text-sm font-semibold">$78K</div>
            </div>
            <div className="text-xs text-muted-foreground">Data analytics</div>
          </div>
        </div>
      </div>

      {/* Proposal Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Proposal</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">1</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">CloudTech Systems</div>
              <div className="text-sm font-semibold">$32K</div>
            </div>
            <div className="text-xs text-muted-foreground">Cloud migration</div>
          </div>
        </div>
      </div>

      {/* Won Column */}
      <div className="shrink-0 w-64 space-y-3">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">Won</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">5</span>
        </div>
        <div className="space-y-2">
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">InnovateLabs</div>
              <div className="text-sm font-semibold">$55K</div>
            </div>
            <div className="text-xs text-muted-foreground">Product development</div>
          </div>
          <div className="p-3 bg-background border border-border/50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">NextGen Solutions</div>
              <div className="text-sm font-semibold">$18K</div>
            </div>
            <div className="text-xs text-muted-foreground">Consulting services</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DemoDataPreview = () => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          <LayoutDashboardIcon className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">Demo Workspace</h1>
      </div>
    </div>

    {/* Content Preview */}
    <div className="space-y-4 p-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center">
          <div className="text-lg font-semibold mb-1">5</div>
          <div className="text-xs text-muted-foreground">People</div>
        </div>
        <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center">
          <div className="text-lg font-semibold mb-1">2</div>
          <div className="text-xs text-muted-foreground">Companies</div>
        </div>
        <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center">
          <div className="text-lg font-semibold mb-1">3</div>
          <div className="text-xs text-muted-foreground">Deals</div>
        </div>
      </div>

      {/* Sample People */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-2 bg-muted/20 border border-border/30 rounded-lg">
          <div className="h-8 w-8 rounded bg-primary text-xs font-semibold text-primary-foreground flex items-center justify-center shrink-0">
            SJ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">Sarah Johnson</div>
            <div className="text-xs text-muted-foreground">VP of Sales</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-2 bg-muted/20 border border-border/30 rounded-lg">
          <div className="h-8 w-8 rounded bg-primary text-xs font-semibold text-primary-foreground flex items-center justify-center shrink-0">
            MC
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">Michael Chen</div>
            <div className="text-xs text-muted-foreground">CEO</div>
          </div>
        </div>
      </div>

      {/* Sample Deal */}
      <div className="p-2 bg-muted/20 border border-border/30 rounded-lg">
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-medium">Enterprise Software License</div>
          <div className="text-xs font-semibold">$45K</div>
        </div>
        <div className="text-xs text-muted-foreground">Lead stage</div>
      </div>
    </div>
  </div>
);

const WhopMembersPreview = ({
  members,
}: {
  members: Array<{
    id: string;
    user: { name?: string | null; username?: string | null; email?: string | null } | null;
    phone?: string | null;
  }>;
}) => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">Whop Members</h1>
      </div>
    </div>

    {/* Content Preview */}
    <div className="space-y-4 p-4">
      <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-center">
        <div className="text-lg font-semibold">{members.length}</div>
        <div className="text-xs text-muted-foreground">{members.length === 1 ? 'member' : 'members'} to import</div>
      </div>

      {/* Members List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">No members available to import</div>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-2 bg-muted/20 border border-border/30 rounded-lg">
              <div className="h-8 w-8 rounded bg-primary text-xs font-semibold text-primary-foreground flex items-center justify-center shrink-0">
                {(member.user?.name?.charAt(0) || member.user?.username?.charAt(0) || 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {member.user?.name || member.user?.username || 'Unknown'}
                </div>
                <div className="text-xs text-muted-foreground truncate">{member.user?.email}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

const EmptyWorkspacePreview = () => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
          <LayoutDashboardIcon className="h-3.5 w-3.5" />
        </div>
        <h1 className="text-base font-semibold">Empty Workspace</h1>
      </div>
    </div>

    {/* Content Preview */}
    <div className="space-y-4 p-4">
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🚀</div>
        <div className="text-sm font-medium mb-3">Start Fresh</div>
        <div className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
          Your workspace is ready. Follow the "Get Started" guide in the sidebar to navigate around the app.
        </div>
      </div>
    </div>
  </div>
);

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
  const params = useParams();
  const step = loaderData.initialStep;
  const [orgName, setOrgName] = useState(loaderData.whopCompany?.title);
  const [teamSize, setTeamSize] = useState('');
  const [firstName, setFirstName] = useState(loaderData.whopUser?.name || '');
  const [lastName, setLastName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ status: string; [key: string]: unknown } | null>(null);
  const [selectedOption, setSelectedOption] = useState<'demo' | 'import' | 'fresh'>('fresh');

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === 'submitting';

  const navigate = useNavigate();

  const handlePayment = async (plan: 'monthly' | 'annual') => {
    setIsProcessingPayment(true);
    setPaymentResult(null);

    try {
      const iframeSdk = createSdk({ appId: loaderData.whopAppId });

      if (plan === 'monthly') {
        if (!loaderData.monthlyCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase({
          id: loaderData.monthlyCheckout.id,
          planId: loaderData.monthlyCheckout.plan.id,
        });
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      } else if (plan === 'annual') {
        if (!loaderData.annualCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase({
          id: loaderData.annualCheckout.id,
          planId: loaderData.annualCheckout.plan.id,
        });
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      }

      navigate(href('/dashboard/:companyId', { companyId: params.companyId as string }), { replace: true });
    } catch (error) {
      setPaymentResult({ status: 'error', error: String(error) });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const totalSteps = 4;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Column - Form Content */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <div className="flex items-center justify-between px-12 py-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <img src="/logo.png" alt="WHOP CRM" className="h-8 w-8 rounded" />
            </div>
            <span className="text-base font-semibold">CRM</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {step} of {totalSteps}
          </span>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col justify-center px-12 py-12">
          {step === 1 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Close more deals, faster and smarter!</h1>
                  <p className="text-lg text-muted-foreground">
                    Stop losing track of leads. See every activity, close deals in half the time, and never miss a
                    follow up again.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="createOrg" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                        Organization name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={loaderData.whopCompany.title}
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Corp"
                        required
                        autoFocus
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="teamSize" className="text-sm font-semibold text-foreground">
                        How big is your team?
                      </Label>
                      <Select value={teamSize} onValueChange={(value) => setTeamSize(value)} name="teamSize">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select team size" className="w-full" />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          <SelectItem value="1-5">1-5 people</SelectItem>
                          <SelectItem value="6-10">6-10 people</SelectItem>
                          <SelectItem value="11-25">11-25 people</SelectItem>
                          <SelectItem value="26-50">26-50 people</SelectItem>
                          <SelectItem value="51-100">51-100 people</SelectItem>
                          <SelectItem value="100+">100+ people</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !orgName?.trim() || !teamSize?.trim()}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? 'Creating...' : 'Continue'}
                  </Button>
                </Form>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Set up your profile</h1>
                  <p className="text-lg text-muted-foreground">
                    Add your details so your team can collaborate with you and assign deals to you easily.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="createUser" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="firstName" className="text-sm font-semibold text-foreground">
                        First name
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        required
                        autoFocus
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="lastName" className="text-sm font-semibold text-foreground">
                        Last name
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>

                  {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 2 && (
                    <p className="text-sm text-destructive">{actionData.error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? 'Saving...' : 'Continue'}
                  </Button>
                </Form>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">Start your 3 day free trial</h1>
                  <p className="text-lg text-muted-foreground">
                    No credit card required! Experience how organized your sales process can be.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Monthly */}
                    <Card
                      className={`cursor-pointer transition-all border relative py-2 ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border'
                      }`}
                      onClick={() => setSelectedPlan('monthly')}
                    >
                      <CardContent className="p-4 text-center space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Monthly</div>
                        <div className="text-xl font-bold text-foreground">$9</div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </CardContent>
                      {selectedPlan === 'monthly' && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-foreground" />
                        </div>
                      )}
                    </Card>

                    {/* Annual */}
                    <Card
                      className={`cursor-pointer transition-all border relative py-2 ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border'
                      }`}
                      onClick={() => setSelectedPlan('annual')}
                    >
                      <CardContent className="p-4 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="text-xs font-medium text-muted-foreground">Annual</div>
                          <Badge
                            variant="default"
                            className="absolute left-1/2 -translate-x-1/2 -top-3.5 text-xs h-6  text-primary-foreground"
                          >
                            Save <span className="font-bold">30%</span>
                          </Badge>
                        </div>
                        <div className="text-xl font-bold text-foreground">$75</div>
                        <div className="text-xs text-muted-foreground">per year</div>
                      </CardContent>
                      {selectedPlan === 'annual' && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-foreground" />
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Feature highlights */}
                  <div className="space-y-3 mb-2">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>People & contact management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Visual sales pipeline</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Team task management</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Activity timeline & notes</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Unlimited team members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Priority support</span>
                      </div>
                    </div>
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
                  <p className="text-sm text-destructive text-center">{actionData.error}</p>
                )}

                <div className="flex flex-col gap-3">
                  {/* Start Trial Form */}
                  <Form method="post">
                    <input type="hidden" name="intent" value="startTrial" />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                    >
                      {isSubmitting ? 'Starting trial...' : 'Start Free Trial (No Credit Card)'}
                    </Button>
                  </Form>

                  <p className="text-xs text-center text-muted-foreground">
                    Or upgrade now to unlock premium features immediately
                  </p>

                  {/* Upgrade Form */}
                  <Form method="post">
                    <input type="hidden" name="intent" value="processPayment" />
                    <input type="hidden" name="selectedPlan" value={selectedPlan} />
                    <Button
                      type="submit"
                      disabled={isProcessingPayment}
                      variant="outline"
                      className="w-full h-10 text-sm font-semibold"
                      onClick={() => handlePayment(selectedPlan)}
                    >
                      {isProcessingPayment
                        ? 'Processing...'
                        : selectedPlan === 'monthly'
                          ? 'Upgrade to Monthly Plan'
                          : 'Upgrade to Annual Plan'}
                    </Button>
                  </Form>
                </div>

                {paymentResult && (
                  <div
                    className={`p-4 rounded-md border ${
                      paymentResult.status === 'ok'
                        ? 'bg-muted/50 border-border text-green-700'
                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}
                  >
                    <pre className="text-xs overflow-auto">{JSON.stringify(paymentResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-foreground">You're all set! 🎉</h1>
                  <p className="text-lg text-muted-foreground">
                    Choose how you'd like to get started with your workspace.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Start Fresh Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('fresh')}
                  className={`w-full cursor-pointer rounded-lg border p-4 transition-all text-left ${
                    selectedOption === 'fresh' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center text-lg shrink-0">
                      🚀
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold mb-1">Start Fresh</div>
                      <div className="text-xs text-muted-foreground">
                        Begin with an empty workspace and add your own data
                      </div>
                    </div>
                  </div>
                </button>

                {/* Demo Data Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('demo')}
                  className={`w-full cursor-pointer rounded-lg border p-4 transition-all text-left ${
                    selectedOption === 'demo' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      ✨
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold mb-1">Load Demo Workspace</div>
                      <div className="text-xs text-muted-foreground mb-2">See how your CRM works with sample data</div>
                    </div>
                  </div>
                </button>

                {/* Import Whop Members Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('import')}
                  className={`w-full cursor-pointer rounded-lg border p-4 transition-all text-left ${
                    selectedOption === 'import' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center text-lg shrink-0">
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold mb-1">Import Whop Members</div>
                      <div className="text-xs text-muted-foreground">
                        Import all members from your Whop as contacts in People table (
                        {loaderData.whopMembers?.length || 0} available)
                      </div>
                    </div>
                  </div>
                </button>

                {/* Complete Button */}
                {selectedOption && (
                  <Form method="post" className="mt-4">
                    <input
                      type="hidden"
                      name="intent"
                      value={
                        selectedOption === 'demo'
                          ? 'loadDemoData'
                          : selectedOption === 'import'
                            ? 'importAllWhopMembers'
                            : 'skipSetup'
                      }
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                    >
                      {isSubmitting
                        ? 'Processing...'
                        : selectedOption === 'demo'
                          ? 'Load Demo Workspace'
                          : selectedOption === 'import'
                            ? `Import ${loaderData.whopMembers?.length || 0} Members`
                            : 'Continue to Workspace'}
                    </Button>
                  </Form>
                )}

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 4 && (
                  <p className="text-sm text-destructive text-center">{actionData.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Mockups */}
      <div className="hidden lg:flex w-1/2 flex-col bg-muted/30 px-12 py-12">
        <div className="flex-1 flex flex-col justify-center">
          {step === 1 && <DashboardMockup orgName={orgName} userName={loaderData.whopUser?.name || ''} />}
          {step === 2 && <TaskDetailMockup />}
          {step === 3 && <SalesFeaturesMockup />}
          {step === 4 && (
            <>
              {selectedOption === 'fresh' && <EmptyWorkspacePreview />}
              {selectedOption === 'demo' && <DemoDataPreview />}
              {selectedOption === 'import' && <WhopMembersPreview members={loaderData.whopMembers || []} />}
            </>
          )}

          {/* Explanatory text */}
          <div className="mt-8 text-center">
            {step === 1 && (
              <p className="text-sm text-muted-foreground">
                See exactly where every deal stands. Know what to do next, every single day.
              </p>
            )}
            {step === 2 && (
              <p className="text-sm text-muted-foreground">
                Never lose a lead again. Every activity, task, and note in one place.
              </p>
            )}
            {step === 3 && (
              <p className="text-sm text-muted-foreground">
                Watch your pipeline grow. Move deals forward with confidence and close more.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
