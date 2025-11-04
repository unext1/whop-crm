import { eq } from 'drizzle-orm';
import { Check, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigation } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { env } from '~/services/env.server';
import { putToast } from '~/services/cookie.server';
import { getAuthorizedUserId, getPublicUser, getTeamMembers, verifyWhopToken } from '~/services/whop.server';
import type { Route } from './+types/new';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists
  const existingUser = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // If both exist, redirect to dashboard (onboarding complete)
  // if (hasOrg && hasUser) {
  //   throw redirect(href('/dashboard/:companyId', { companyId }));
  // }

  // Determine starting step based on what exists
  let initialStep = 1;
  if (hasOrg && !hasUser) {
    initialStep = 2; // Skip org creation, go to user profile
  }

  // Create checkout sessions for both monthly and annual plans
  const monthlyCheckout = await createCheckoutSession(env.WHOP_PREMIUM_PLAN_ID, companyId);
  const annualCheckout = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

  // Get team members for invitation step (only if user has admin/moderator access)
  const teamMembers = await getTeamMembers(companyId);

  return {
    whopUser: {
      id: authorizedUser.id,
      username: authorizedUser.username || null,
      name: authorizedUser.name,
      email: authorizedUser.email,
    },
    initialStep,
    hasOrg,
    hasUser,
    teamMembers,
    monthlyCheckout,
    annualCheckout,
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

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    await db.insert(organizationTable).values({
      id: companyId,
      name: name.trim(),
      ownerId: authorizedUser.id,
    });

    return data({ success: true, step: 1, message: 'Organization created' } as const);
  }

  if (intent === 'createUser') {
    const firstName = formData.get('firstName')?.toString();
    const lastName = formData.get('lastName')?.toString();

    if (!firstName || !lastName) {
      return data({ error: 'First name and last name are required', step: 2 } as const, { status: 400 });
    }

    await db.insert(userTable).values({
      id: authorizedUser.id,
      email: authorizedUser.email || 'user@example.com',
      name: firstName.trim(),
      lastName: lastName.trim(),
      whopUserId: userId,
      organizationId: companyId,
      profilePictureUrl: publicWhopUser.profile_picture?.url || null,
    });

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'selectPlan') {
    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Please select a valid plan', step: 3 } as const, { status: 400 });
    }

    // For now, we'll just proceed to the next step
    // In a real implementation, you might want to start the checkout process here
    return data({ success: true, step: 3, selectedPlan, message: `${selectedPlan} plan selected` } as const);
  }

  if (intent === 'processPayment') {
    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Invalid plan selection', step: 3 } as const, { status: 400 });
    }

    // Here you would typically integrate with a payment processor
    // For now, we'll simulate successful payment and proceed
    console.log(`Processing payment for ${selectedPlan} plan for company ${companyId}`);

    // In a real implementation, you would:
    // 1. Create a checkout session
    // 2. Redirect to payment processor
    // 3. Wait for webhook confirmation
    // 4. Only proceed if payment is successful

    return data({ success: true, step: 3, selectedPlan, message: 'Payment processed successfully' } as const);
  }

  if (intent === 'addTeamMembers') {
    const selectedMembers = formData.getAll('selectedMembers') as string[];

    if (selectedMembers.length === 0) {
      return data({ error: 'Please select at least one team member', step: 4 } as const, { status: 400 });
    }

    // Get team members data to create user profiles
    const teamMembers = await getTeamMembers(companyId);
    const membersToAdd = teamMembers.filter((member) => selectedMembers.includes(member.id));

    // Create user profiles for selected team members (skip if they already exist)
    for (const member of membersToAdd) {
      const existingUser = await db.select().from(userTable).where(eq(userTable.id, member.id)).limit(1);

      if (existingUser.length === 0) {
        // Create user profile with basic info from team member data
        await db.insert(userTable).values({
          id: member.id,
          email: member.email || `${member.name?.toLowerCase().replace(/\s+/g, '') || 'user'}@example.com`,
          name: member.name || 'Team Member',
          organizationId: companyId,
          whopUserId: member.id,
        });
      }
    }

    return data({ success: true, step: 4, message: `${selectedMembers.length} team member(s) added` } as const);
  }

  if (intent === 'complete') {
    const headers = await putToast({
      title: 'Welcome! 🎉',
      message: 'Your workspace is ready to go',
      variant: 'default',
    });

    return redirect(href('/dashboard/:companyId', { companyId }), { headers });
  }

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
  const [step, setStep] = useState(loaderData.initialStep);
  const [orgName, setOrgName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Auto-advance to next step on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success && actionData.step === step && !isSubmitting) {
      // Skip team member step if there are no team members to add
      if (step === 3 && (!loaderData.teamMembers || loaderData.teamMembers.length === 0)) {
        setStep(5); // Skip to completion
      } else {
        const timer = setTimeout(() => setStep(step + 1), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [actionData, step, isSubmitting, loaderData.teamMembers]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  return (
    <div className="flex-1 overflow-hidden bg-linear-to-br from-background via-muted/30 to-muted/50 flex items-center justify-center p-4">
      {/* Main Content */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={step}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Create your workspace</h1>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createOrg" />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-muted-foreground text-sm">
                      Organization name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter your organization name..."
                      required
                      autoFocus
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 1 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !orgName.trim()}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Continue'}
                </Button>
              </Form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Let's get to know you</h1>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createUser" />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-muted-foreground text-sm">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name..."
                      required
                      autoFocus
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-muted-foreground text-sm">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name..."
                      required
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 2 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !firstName || !lastName}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </Button>
              </Form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Choose your plan</h1>
                <p className="text-lg text-muted-foreground">
                  Select a subscription plan to get started with premium features
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Monthly Plan */}
                <Card
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedPlan === 'monthly' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPlan('monthly')}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Monthly</CardTitle>
                      {selectedPlan === 'monthly' && (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <CardDescription>Perfect for getting started and testing premium features</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      $19<span className="text-lg font-normal text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        All premium features
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Priority support
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Cancel anytime
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Annual Plan */}
                <Card
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedPlan === 'annual' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPlan('annual')}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Annual</CardTitle>
                      {selectedPlan === 'annual' && (
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <CardDescription>Best value with 7-day free trial and 2 months savings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-bold">
                        $190<span className="text-lg font-normal text-muted-foreground">/year</span>
                      </div>
                      <Badge variant="secondary">Save 17%</Badge>
                    </div>
                    <div className="text-sm text-green-600 font-medium">7-day free trial included</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        All premium features
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Priority support
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        7-day free trial
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Cancel anytime
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
                <p className="text-sm text-destructive text-center">{actionData.error}</p>
              )}

              <div className="flex justify-center">
                <div className="w-full max-w-md space-y-4">
                  {/* Plan Selection Form */}
                  <Form method="post" className="space-y-4">
                    <input type="hidden" name="intent" value="selectPlan" />
                    <input type="hidden" name="selectedPlan" value={selectedPlan} />

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      {isSubmitting
                        ? 'Processing...'
                        : `Continue with ${selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Plan`}
                    </Button>
                  </Form>

                  {/* Payment Processing */}
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground mb-4">Secure payment powered by Whop</div>

                    {selectedPlan === 'monthly' && loaderData.monthlyCheckout && (
                      <Button
                        onClick={() => {
                          const url = (loaderData.monthlyCheckout as any)?.checkoutUrl;
                          if (url) window.location.href = url;
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Start Monthly Subscription ($19/month)
                      </Button>
                    )}

                    {selectedPlan === 'annual' && loaderData.annualCheckout && (
                      <Button
                        onClick={() => {
                          const url = (loaderData.annualCheckout as any)?.checkoutUrl;
                          if (url) window.location.href = url;
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Start Annual Subscription ($190/year - 7 day trial)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Add team members</h1>
                <p className="text-lg text-muted-foreground">Invite your team members to join the workspace</p>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="addTeamMembers" />

                <div className="space-y-4">
                  {loaderData.teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center space-x-3 p-4 border rounded-lg">
                      <input
                        type="checkbox"
                        id={`member-${member.id}`}
                        name="selectedMembers"
                        value={member.id}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 4 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(5)} className="flex-1 h-12">
                    Skip for now
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    {isSubmitting ? 'Adding members...' : 'Add members'}
                  </Button>
                </div>
              </Form>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full"
                >
                  <Sparkles className="w-8 h-8 text-primary" />
                </motion.div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold text-foreground">Welcome to your workspace!</h1>
                  <p className="text-base text-muted-foreground">Everything is set up and ready to go.</p>
                </div>

                <Form method="post" className="pt-4">
                  <input type="hidden" name="intent" value="complete" />
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    Get started
                  </Button>
                </Form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-xs text-muted-foreground">© 2025 WHOP CRM · Privacy Policy · Support · Sign out</p>
      </div>
    </div>
  );
};

export default OnboardingPage;
