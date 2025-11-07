import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { Check, CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigation, useParams } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { boardColumnTable, boardTable, organizationTable, userTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { putToast } from '~/services/cookie.server';
import { env } from '~/services/env.server';
import {
  getAuthorizedUserId,
  getPublicUser,
  hasOrganizationPremiumAccess,
  verifyWhopToken,
} from '~/services/whop.server';
import type { Route } from './+types/new';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists
  const existingUser = await db.select().from(userTable).where(eq(userTable.whopUserId, userId)).limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // Check if organization already has premium access
  const hasPremiumAccess = hasOrg ? await hasOrganizationPremiumAccess(companyId) : false;

  // If both exist, redirect to dashboard (onboarding complete)
  // if (hasOrg && hasUser) {
  //   throw redirect(href('/dashboard/:companyId', { companyId }));
  // }

  // Determine starting step based on what exists
  let initialStep = 1;
  if (hasOrg && !hasUser) {
    initialStep = 2; // Skip org creation, go to user profile
  } else if (hasOrg && hasUser) {
    if (hasPremiumAccess) {
      throw redirect(href('/dashboard/:companyId', { companyId }));
    }
    initialStep = 3; // Org and user exist but no premium - go to payment
  }

  const monthlyCheckout = await createCheckoutSession(env.WHOP_PREMIUM_PLAN_ID, companyId);
  const annualCheckout = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

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
    const industry = formData.get('industry')?.toString();

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    if (!teamSize) {
      return data({ error: 'Team size is required', step: 1 } as const, { status: 400 });
    }

    if (!industry) {
      return data({ error: 'Industry is required', step: 1 } as const, { status: 400 });
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
        // ownerId will be set when user is created in step 2
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

    // Update the default board to set the owner
    await db.update(boardTable).set({ ownerId: createdUser.id }).where(eq(boardTable.companyId, companyId));

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'processPayment') {
    // Check if organization already has premium access
    const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);

    // If they already have premium, redirect to dashboard
    if (hasPremiumAccess) {
      const headers = await putToast({
        title: 'Welcome! 🎉',
        message: 'Your Organization is ready to go',
        variant: 'default',
      });
      return redirect(href('/dashboard/:companyId', { companyId }), { headers });
    }

    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Please select a valid plan', step: 3 } as const, { status: 400 });
    }

    // Get the appropriate checkout session
    const planId = selectedPlan === 'monthly' ? env.WHOP_PREMIUM_PLAN_ID : env.WHOP_ANNUAL_PLAN_ID;
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

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

// Mockup Components
const DashboardMockup = ({ orgName }: { orgName: string }) => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border border-border/40 bg-muted/10 px-4 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded bg-primary/80 flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xs">W</span>
        </div>
        <span className="text-sm font-semibold">{orgName || 'Your Company'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-6 w-6 rounded-full bg-muted/30" />
      </div>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-muted/15 border border-border/30 rounded-lg" />
      ))}
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="h-5 w-24 bg-muted/30 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted/15 border border-border/30 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-24 bg-muted/30 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted/15 border border-border/30 rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

const TaskDetailMockup = (_props?: { orgName?: string }) => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border border-border/40 bg-muted/10 px-4 rounded-lg">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">Tasks</span>
      </div>
      <div className="h-6 w-6 rounded-full bg-muted/30" />
    </div>

    {/* Table */}
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div>Task</div>
        <div>Owner</div>
        <div>Due</div>
        <div>Status</div>
        <div>Priority</div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-5 gap-3 px-4 py-3 bg-muted/10 border border-border/30 rounded-lg">
          <div className="h-4 bg-muted/30 rounded w-32" />
          <div className="h-4 bg-muted/30 rounded w-24" />
          <div className="h-4 bg-muted/30 rounded w-20" />
          <div className="h-4 bg-muted/30 rounded w-16" />
          <div className="h-4 bg-muted/30 rounded w-12" />
        </div>
      ))}
    </div>
  </div>
);

const SalesFeaturesMockup = (_props?: { orgName?: string }) => (
  <div className="w-full max-w-2xl space-y-4">
    {/* Header */}
    <div className="flex h-14 items-center justify-between border border-border/40 bg-muted/10 px-4 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-primary/60" />
        <span className="text-sm font-semibold">Sales Pipeline</span>
      </div>
      <div className="h-6 w-6 rounded-full bg-muted/30" />
    </div>

    {/* Kanban Columns */}
    <div className="flex gap-3 overflow-x-auto pb-2">
      {['Lead', 'Qualified', 'Proposal', 'Won'].map((col, idx) => (
        <div key={col} className="shrink-0 w-48 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: idx === 0 ? '#3b82f6' : idx === 1 ? '#eab308' : idx === 2 ? '#a855f7' : '#22c55e',
              }}
            />
            <span className="text-xs font-medium">{col}</span>
            <span className="text-xs text-muted-foreground">{[3, 2, 1, 5][idx]}</span>
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="p-3 bg-muted/10 border border-border/30 rounded-lg space-y-2">
              <div className="h-3 bg-muted/30 rounded w-3/4" />
              <div className="h-2 bg-muted/30 rounded w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
  const params = useParams();
  const step = loaderData.initialStep;
  const [orgName, setOrgName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [industry, setIndustry] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ status: string; [key: string]: unknown } | null>(null);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const handlePayment = async (plan: 'monthly' | 'annual') => {
    setIsProcessingPayment(true);
    setPaymentResult(null);

    try {
      const iframeSdk = createSdk({ appId: loaderData.whopAppId });

      if (plan === 'monthly') {
        if (!loaderData.monthlyCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase(loaderData.monthlyCheckout);
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      } else if (plan === 'annual') {
        if (!loaderData.annualCheckout) {
          throw new Error('Checkout session not available');
        }
        const result = await iframeSdk.inAppPurchase(loaderData.annualCheckout);
        if (result.status === 'ok') {
          setTimeout(() => window.location.reload(), 2000);
        }
      }

      // Payment successful - redirect to dashboard
      setTimeout(() => {
        window.location.href = href('/dashboard/:companyId', { companyId: params.companyId as string });
      }, 2000);
    } catch (error) {
      setPaymentResult({ status: 'error', error: String(error) });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const totalSteps = 3;

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
                  <h1 className="text-3xl font-bold text-foreground">Create your organization</h1>
                  <p className="text-lg text-muted-foreground">
                    Set up your organization so you can start managing your work today
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
                      <select
                        id="teamSize"
                        name="teamSize"
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                        required
                        className="h-10 px-3 text-sm border border-border rounded-md bg-background"
                      >
                        <option value="">Select team size</option>
                        <option value="1-5">1-5 people</option>
                        <option value="6-10">6-10 people</option>
                        <option value="11-25">11-25 people</option>
                        <option value="26-50">26-50 people</option>
                        <option value="51-100">51-100 people</option>
                        <option value="100+">100+ people</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="industry" className="text-sm font-semibold text-foreground">
                        Industry
                      </Label>
                      <select
                        id="industry"
                        name="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        required
                        className="h-10 px-3 text-sm border border-border rounded-md bg-background"
                      >
                        <option value="">Select industry</option>
                        <option value="technology">Technology</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="finance">Finance</option>
                        <option value="education">Education</option>
                        <option value="retail">Retail</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="consulting">Consulting</option>
                        <option value="real-estate">Real Estate</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 1 && (
                    <p className="text-sm text-destructive">{actionData.error}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !orgName.trim() || !teamSize || !industry}
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
                  <h1 className="text-3xl font-bold text-foreground">Create your profile</h1>
                  <p className="text-lg text-muted-foreground">
                    Set up your personal profile so your team knows who you are
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
                  <h1 className="text-3xl font-bold text-foreground">Choose your plan</h1>
                  <p className="text-lg text-muted-foreground">Select the plan that works best for your team</p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {!loaderData.hasPremiumAccess && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Monthly */}
                      <Card
                        className={`cursor-pointer transition-all border ${
                          selectedPlan === 'monthly'
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border'
                        }`}
                        onClick={() => setSelectedPlan('monthly')}
                      >
                        <CardContent className="p-4 text-center space-y-1">
                          <div className="text-xs font-medium text-muted-foreground">Monthly</div>
                          <div className="text-xl font-bold text-foreground">$19</div>
                          <div className="text-xs text-muted-foreground">per month</div>
                        </CardContent>
                      </Card>

                      {/* Annual */}
                      <Card
                        className={`cursor-pointer transition-all border relative ${
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
                              variant="secondary"
                              className="text-xs h-4 bg-primary/20 text-primary hover:bg-primary/30"
                            >
                              Save 17%
                            </Badge>
                          </div>
                          <div className="text-xl font-bold text-foreground">$190</div>
                          <div className="text-xs text-muted-foreground">per year</div>
                        </CardContent>
                        {selectedPlan === 'annual' && (
                          <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-background" />
                          </div>
                        )}
                      </Card>
                    </div>

                    {/* Trust badges */}
                    <div className="flex  items-center  gap-2 pt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary/60" />
                        Access to all team members
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary/60" />
                        Unlocked all features
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-primary/60" />
                        Priority support
                      </div>
                    </div>
                  </>
                )}

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
                  <p className="text-sm text-destructive text-center">{actionData.error}</p>
                )}

                <Form method="post" className="flex flex-col gap-6">
                  <input type="hidden" name="intent" value="processPayment" />
                  {!loaderData.hasPremiumAccess && <input type="hidden" name="selectedPlan" value={selectedPlan} />}

                  <Button
                    type="submit"
                    disabled={isSubmitting || isProcessingPayment}
                    className="h-10 text-sm font-semibold bg-primary hover:bg-primary/90"
                    onClick={() => handlePayment(selectedPlan)}
                  >
                    {isSubmitting
                      ? 'Processing...'
                      : isProcessingPayment
                        ? 'Processing payment...'
                        : loaderData.hasPremiumAccess
                          ? 'Get Started'
                          : selectedPlan === 'monthly'
                            ? 'Subscribe to Monthly Plan'
                            : 'Start Free Today'}
                  </Button>
                </Form>

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
        </div>
      </div>

      {/* Right Column - Mockups */}
      <div className="hidden lg:flex w-1/2 flex-col items-center bg-muted/30 justify-center px-12 py-12">
        {step === 1 && <DashboardMockup orgName={orgName} />}
        {step === 2 && <TaskDetailMockup />}
        {step === 3 && <SalesFeaturesMockup />}
      </div>
    </div>
  );
};

export default OnboardingPage;
