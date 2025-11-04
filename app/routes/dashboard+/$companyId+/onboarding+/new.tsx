import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { Check, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigation } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { env } from '~/services/env.server';
import { putToast } from '~/services/cookie.server';
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
  const existingUser = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);

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
  } else if (hasOrg && hasUser && hasPremiumAccess) {
    initialStep = 5; // Skip everything if org exists, user exists, and has premium - go to completion
  }

  // Create checkout sessions for both monthly and annual plans
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

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    await db.insert(organizationTable).values({
      id: companyId,
      name: name.trim(),
    });

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

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'processPayment') {
    // Check if organization already has premium access
    const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);

    // If they already have premium, skip payment and go to completion
    if (hasPremiumAccess) {
      return data({
        success: true,
        step: 3,
        skipPayment: true,
        message: 'Organization already has premium access',
      } as const);
    }

    const selectedPlan = formData.get('selectedPlan')?.toString();

    if (!selectedPlan || !['monthly', 'annual'].includes(selectedPlan)) {
      return data({ error: 'Please select a valid plan', step: 3 } as const, { status: 400 });
    }

    // Get the appropriate checkout session
    const checkoutSession =
      selectedPlan === 'monthly'
        ? await createCheckoutSession(env.WHOP_PREMIUM_PLAN_ID, companyId)
        : await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

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

  if (intent === 'complete') {
    const headers = await putToast({
      title: 'Welcome! 🎉',
      message: 'Your Organization is ready to go',
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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const handlePayment = useCallback(
    async (checkoutSession: unknown) => {
      setIsProcessingPayment(true);

      try {
        const iframeSdk = createSdk({ appId: loaderData.whopAppId });
        const result = await iframeSdk.inAppPurchase(checkoutSession as { planId: string; id?: string });

        if (result.status === 'ok') {
          // Payment successful - advance to completion
          setStep(5);
        } else {
          // Payment failed - stay on current step
          // Error handled silently
        }
      } catch {
        // Payment error - stay on current step
      } finally {
        setIsProcessingPayment(false);
      }
    },
    [loaderData.whopAppId],
  );

  // Handle payment processing and step advancement
  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success && actionData.step === step && !isSubmitting) {
      if (step === 3 && 'checkoutSession' in actionData) {
        // Process payment with the checkout session
        handlePayment(actionData.checkoutSession);
      } else if (step === 3 && 'skipPayment' in actionData && actionData.skipPayment) {
        // Organization already has premium - skip to completion
        const timer = setTimeout(() => setStep(5), 100);
        return () => clearTimeout(timer);
      } else if (step === 3 && !('checkoutSession' in actionData)) {
        // Plan selected but no checkout session - stay on step 3
      } else {
        // Other steps - advance normally
        const timer = setTimeout(() => setStep(step + 1), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [actionData, step, isSubmitting, handlePayment]);

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
                <h1 className="text-3xl font-semibold text-foreground">
                  {loaderData.hasPremiumAccess ? 'Premium Access Confirmed' : 'Choose your plan'}
                </h1>
                <p className="text-base text-muted-foreground">
                  {loaderData.hasPremiumAccess
                    ? 'Your organization already has premium access'
                    : 'One subscription unlocks premium features for your entire team'}
                </p>
                {loaderData.hasPremiumAccess ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-sm text-green-700">
                    <Check className="w-4 h-4" />
                    Premium access active
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-full text-sm text-primary">
                    <Check className="w-4 h-4" />
                    All team members get premium access for free
                  </div>
                )}
              </div>

              {!loaderData.hasPremiumAccess && (
                <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
                  {/* Monthly Plan */}
                  <Card
                    className={`cursor-pointer transition-all duration-200 flex-1 ${
                      selectedPlan === 'monthly'
                        ? 'ring-2 ring-primary border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPlan('monthly')}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-muted-foreground">Monthly</div>
                        <div className="text-3xl font-bold">
                          $19<span className="text-lg font-normal text-muted-foreground">/mo</span>
                        </div>
                        <div className="text-sm text-muted-foreground">Perfect for getting started</div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Annual Plan */}
                  <Card
                    className={`cursor-pointer transition-all duration-200 flex-1 relative ${
                      selectedPlan === 'annual'
                        ? 'ring-2 ring-primary border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPlan('annual')}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="text-sm font-medium text-muted-foreground">Annual</div>
                          <Badge variant="secondary" className="text-xs">
                            Save 17%
                          </Badge>
                        </div>
                        <div className="text-3xl font-bold">
                          $190<span className="text-lg font-normal text-muted-foreground">/yr</span>
                        </div>
                        <div className="text-sm text-green-600 font-medium">7-day free trial</div>
                      </div>
                    </CardContent>
                    {selectedPlan === 'annual' && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 3 && (
                <p className="text-sm text-destructive text-center">{actionData.error}</p>
              )}

              <div className="flex justify-center">
                <div className="w-full max-w-sm space-y-4">
                  <Form method="post">
                    <input type="hidden" name="intent" value="processPayment" />
                    {!loaderData.hasPremiumAccess && <input type="hidden" name="selectedPlan" value={selectedPlan} />}

                    <Button
                      type="submit"
                      disabled={isSubmitting || isProcessingPayment}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      {isSubmitting
                        ? 'Processing...'
                        : isProcessingPayment
                          ? 'Processing payment...'
                          : loaderData.hasPremiumAccess
                            ? 'Continue'
                            : `Subscribe to ${selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Plan`}
                    </Button>
                  </Form>

                  {!loaderData.hasPremiumAccess && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Secure payment powered by Whop</div>
                    </div>
                  )}
                </div>
              </div>
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
