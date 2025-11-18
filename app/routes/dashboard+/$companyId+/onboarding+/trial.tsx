import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { Check, Clock, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { href, redirect, useNavigate, useParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { env } from '~/services/env.server';
import { hasOrganizationPremiumAccess, verifyWhopToken } from '~/services/whop.server';
import type { Route } from './+types/trial';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  await verifyWhopToken(request);

  // Check if organization exists
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  if (!organization) {
    throw redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
  }

  // If they have premium access, redirect to dashboard
  const hasPremiumAccess = await hasOrganizationPremiumAccess(companyId);
  if (hasPremiumAccess) {
    throw redirect(href('/dashboard/:companyId', { companyId }));
  }

  // Check if trial has actually ended
  if (organization.trialEnd) {
    const trialEndDate = new Date(organization.trialEnd);
    const now = new Date();
    if (now <= trialEndDate) {
      // Trial is still active, redirect to dashboard
      throw redirect(href('/dashboard/:companyId', { companyId }));
    }
  }

  const monthlyCheckout = await createCheckoutSession(env.WHOP_MONTHLY_PLAN_ID, companyId);
  const annualCheckout = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

  return {
    organization,
    monthlyCheckout,
    annualCheckout,
    whopAppId: env.WHOP_APP_ID,
  };
};

const TrialEndedPage = ({ loaderData }: Route.ComponentProps) => {
  const params = useParams();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handlePayment = async (plan: 'monthly' | 'annual') => {
    setIsProcessingPayment(true);

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
    } catch (_error) {
      // Payment error - user will see the error from the iframe SDK
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const iframeSdk = createSdk({ appId: loaderData.whopAppId });

  function openProfile() {
    iframeSdk.openExternalUrl({ url: 'https://whop.com/@maybelaurence' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <img src="/logo.png" alt="WHOP CRM" className="w-10 h-10 rounded-lg absolute top-4 left-4" />

      <div className="w-full max-w-2xl space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative rounded-full bg-primary/10 p-6">
              <Clock className="h-12 w-12 text-primary" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Your Pro trial has ended</h1>
          <p className="text-lg text-muted-foreground">
            Upgrade to maintain access to your organization and premium features
          </p>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* Monthly Plan */}
          <Card
            className={`cursor-pointer transition-all border relative ${
              selectedPlan === 'monthly'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border/50 hover:border-border'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <CardContent className="p-6 text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Monthly</div>
              <div className="text-3xl font-bold text-foreground">$19</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </CardContent>
            {selectedPlan === 'monthly' && (
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </Card>

          {/* Annual Plan */}
          <Card
            className={`cursor-pointer transition-all border relative ${
              selectedPlan === 'annual'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border/50 hover:border-border'
            }`}
            onClick={() => setSelectedPlan('annual')}
          >
            <CardContent className="p-6 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="text-sm font-medium text-muted-foreground">Annual</div>
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-semibold">
                  Save 35%
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground">$149</div>
              <div className="text-sm text-muted-foreground">per year</div>
            </CardContent>
            {selectedPlan === 'annual' && (
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
          </Card>
        </div>

        {/* Primary CTA */}
        <div className="space-y-3">
          <Button
            onClick={() => handlePayment(selectedPlan)}
            disabled={isProcessingPayment}
            className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90"
            size="lg"
          >
            {isProcessingPayment
              ? 'Processing...'
              : selectedPlan === 'monthly'
                ? 'Upgrade to Monthly Plan'
                : 'Upgrade to Annual Plan'}
          </Button>
        </div>

        <Separator />

        {/* Support Section */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Need any help from us?</p>
          <Button
            variant="outline"
            onClick={() => {
              openProfile();
            }}
            className="w-full h-11 text-sm"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Contact me
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrialEndedPage;
