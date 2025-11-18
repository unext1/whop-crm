import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { Calendar, Check, CreditCard, ExternalLink, Package, X } from 'lucide-react';
import { useState } from 'react';
import { href, Link, useLoaderData, useParams } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { createCheckoutSession } from '~/services/checkout.server';
import { env } from '~/services/env.server';
import { hasOrganizationPremiumAccess, hasPremiumAccess, requireUser, whopSdk } from '~/services/whop.server';
import type { Route } from './+types/index';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);

  // Check premium access (organization-only model)
  const premiumAccess = await hasPremiumAccess({ request, companyId });
  const orgPremiumAccess = await hasOrganizationPremiumAccess(companyId);

  // Fetch organization details
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  // Check if user has active trial (no membershipId but has trialEnd)
  let hasActiveTrial = false;
  if (organization?.trialEnd && !organization.membershipId) {
    const trialEndDate = new Date(organization.trialEnd);
    const now = new Date();
    hasActiveTrial = now <= trialEndDate;
  }

  // Fetch the organization's membership to the app (if it exists and not in trial)
  let appMembership = null;
  if (organization?.membershipId && !hasActiveTrial) {
    try {
      appMembership = await whopSdk.memberships.retrieve(organization.membershipId);
    } catch (_error) {
      // Membership might not exist, continue without it
    }
  }

  const monthlyCheckoutSession = await createCheckoutSession(env.WHOP_MONTHLY_PLAN_ID, companyId);
  const annualCheckoutSession = await createCheckoutSession(env.WHOP_ANNUAL_PLAN_ID, companyId);

  // Check if organization ever had premium access
  const everHadPremium = organization ? organization.hadPremiumBefore : false;

  return {
    appMembership,
    premiumAccess,
    orgPremiumAccess,
    organization,
    monthlyCheckoutSession,
    annualCheckoutSession,
    whopAppId: env.WHOP_APP_ID,
    everHadPremium,
    hasActiveTrial,
  };
};

const BillingPage = () => {
  const {
    appMembership,
    orgPremiumAccess,
    organization,
    monthlyCheckoutSession,
    annualCheckoutSession,
    whopAppId,
    everHadPremium,
    hasActiveTrial,
  } = useLoaderData<typeof loader>();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ status: string; error?: string } | null>(null);

  const handlePurchase = async (plan: 'monthly' | 'annual') => {
    setPurchasing(true);
    setPurchaseResult(null);

    try {
      const iframeSdk = createSdk({ appId: whopAppId });

      const checkoutSession = plan === 'monthly' ? monthlyCheckoutSession : annualCheckoutSession;
      if (!checkoutSession) {
        throw new Error('Checkout session not available');
      }

      const result = await iframeSdk.inAppPurchase({
        id: checkoutSession.id,
        planId: checkoutSession.plan.id,
      });
      setPurchaseResult(result);

      if (result.status === 'ok') {
        // Reload page after successful purchase
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      setPurchaseResult({ status: 'error', error: String(error) });
    } finally {
      setPurchasing(false);
    }
  };
  const params = useParams();
  const companyId = params.companyId as string;
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-1">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-base font-semibold">Billing & Subscriptions</h1>

            {everHadPremium && !orgPremiumAccess && (
              <Badge variant="destructive" className="h-5 text-xs">
                Membership Ended - Renew Now
              </Badge>
            )}
          </div>
          <Link
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            to={href('/dashboard/:companyId', { companyId })}
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Organization Subscription Required Notice */}
          {!orgPremiumAccess && (
            <div className="p-4 border border-primary bg-primary/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">Organization Subscription Required</h3>
                  <p className="text-sm text-muted-foreground">
                    This organization requires a premium subscription to access the dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Section - Show if on trial (so they can upgrade) OR if no premium access */}
          {(hasActiveTrial || !orgPremiumAccess) && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">Choose Your Plan</h2>
                <p className="text-muted-foreground mt-2">Unlock premium features for your entire organization</p>
              </div>

              {/* Pricing Cards - Similar to trial page */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Purchase Button */}
              <div className="flex justify-center">
                <Button
                  onClick={() => handlePurchase(selectedPlan)}
                  size="lg"
                  className="w-full md:w-auto px-8 py-3 text-sm font-semibold"
                  disabled={purchasing}
                >
                  {purchasing
                    ? 'Processing...'
                    : selectedPlan === 'monthly'
                      ? 'Upgrade to Monthly Plan'
                      : 'Upgrade to Annual Plan'}
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Secure payment via Whop</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Cancel anytime</span>
                </div>
              </div>

              {purchaseResult && (
                <div className="max-w-md mx-auto">
                  <div
                    className={`p-4 rounded-md border ${
                      purchaseResult.status === 'ok'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <pre className="text-xs overflow-auto">{JSON.stringify(purchaseResult, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Premium Status */}
          {orgPremiumAccess && (
            <div className="p-6 bg-background border border-primary rounded-lg">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-foreground">
                    {hasActiveTrial ? 'Free Trial Active' : 'Premium Active'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveTrial
                      ? 'Your 3 day free trial is active. Upgrade anytime to continue using premium features.'
                      : 'Your organization has premium access. All team members can use advanced features.'}
                  </p>
                  {hasActiveTrial && organization?.trialEnd && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Trial ends: {new Date(organization.trialEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Organization Status */}
          {organization && (
            <div className="p-6 bg-muted/30 backdrop-blur-md border border-border rounded-lg shadow-sm">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Organization Status</h2>
                  <p className="text-sm text-muted-foreground mt-1">Current plan and subscription details</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge
                      variant={hasActiveTrial || organization.plan === 'premium' ? 'default' : 'secondary'}
                      className="h-5 text-xs"
                    >
                      {hasActiveTrial ? 'Trial' : organization.plan || 'free'}
                    </Badge>
                  </div>
                  {hasActiveTrial && organization.trialStart && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Trial Started</span>
                      <span className="text-sm">{new Date(organization.trialStart).toLocaleDateString()}</span>
                    </div>
                  )}
                  {hasActiveTrial && organization.trialEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Trial Ends</span>
                      <span className="text-sm">{new Date(organization.trialEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                  {!hasActiveTrial && organization.membershipId && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Membership ID</span>
                      <span className="text-sm font-mono">{organization.membershipId}</span>
                    </div>
                  )}
                  {!hasActiveTrial && organization.subscriptionStart && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Subscription Start</span>
                      <span className="text-sm">{new Date(organization.subscriptionStart).toLocaleDateString()}</span>
                    </div>
                  )}
                  {!hasActiveTrial && organization.subscriptionEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Subscription End</span>
                      <span className="text-sm">{new Date(organization.subscriptionEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Your Subscription - Only show if not in trial and membership exists */}
          {appMembership && !hasActiveTrial && (
            <div className="p-6 bg-muted/30 backdrop-blur-md border border-border rounded-lg shadow-sm">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Your Subscription
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Manage your subscription and billing</p>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{'Premium'}</h3>
                        <Badge
                          variant={
                            appMembership.status === 'active'
                              ? 'default'
                              : appMembership.status === 'trialing'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="h-5 text-xs capitalize"
                        >
                          {appMembership.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Membership ID: {appMembership.id}</p>
                    </div>
                    {appMembership.manage_url && (
                      <Button variant="default" size="sm" asChild>
                        <a href={appMembership.manage_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                          <ExternalLink className="h-3 w-3" />
                          Manage Subscription
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {appMembership.renewal_period_start && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Period Start</p>
                          <p className="font-medium">
                            {new Date(appMembership.renewal_period_start).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {appMembership.renewal_period_end && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Period End</p>
                          <p className="font-medium">
                            {new Date(appMembership.renewal_period_end).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {appMembership.currency && (
                      <div>
                        <p className="text-xs text-muted-foreground">Currency</p>
                        <p className="font-medium uppercase">{appMembership.currency}</p>
                      </div>
                    )}
                    {appMembership.cancel_at_period_end && (
                      <div>
                        <Badge variant="destructive" className="h-5 text-xs">
                          Cancels at period end
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
