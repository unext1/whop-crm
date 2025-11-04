import { createSdk } from '@whop/iframe';
import { eq } from 'drizzle-orm';
import { Calendar, CreditCard, ExternalLink, Package } from 'lucide-react';
import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
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

  // Fetch the organization's membership to the app (if it exists)
  let appMembership = null;
  if (organization?.membershipId) {
    try {
      appMembership = await whopSdk.memberships.retrieve(organization.membershipId);
    } catch (error) {
      console.error('Failed to fetch app membership:', error);
    }
  }

  const checkoutSession = await createCheckoutSession(env.WHOP_PREMIUM_PLAN_ID, companyId);

  return {
    appMembership,
    premiumAccess,
    orgPremiumAccess,
    organization,
    checkoutSession,
    whopAppId: env.WHOP_APP_ID,
  };
};

const BillingPage = () => {
  const { appMembership, premiumAccess, orgPremiumAccess, organization, checkoutSession, whopAppId } =
    useLoaderData<typeof loader>();

  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  const handlePurchase = async () => {
    setPurchasing(true);
    setPurchaseResult(null);

    try {
      // Dynamically import iframe SDK (client-side only)

      const iframeSdk = createSdk({ appId: whopAppId });
      if (!checkoutSession) {
        throw new Error('Checkout session not available');
      }

      const result = await iframeSdk.inAppPurchase(checkoutSession);
      setPurchaseResult(result);

      if (result.status === 'ok') {
        // Reload page after successful purchase
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      setPurchaseResult({ status: 'error', error: String(error) });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            <CreditCard className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Billing & Subscriptions</h1>
          {premiumAccess.hasAccess && (
            <Badge variant="secondary" className="h-5 text-xs">
              Premium {premiumAccess.accessLevel === 'organization' ? '(Organization-wide)' : '(Individual)'}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Organization Subscription Required Notice */}
          {!orgPremiumAccess && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Organization Subscription Required</h3>
                    <p className="text-sm text-foreground">
                      This organization requires a premium subscription to access the dashboard. Organization admins can
                      upgrade below to grant access for all team members.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Purchase Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Premium</CardTitle>
              <CardDescription>
                Get access to advanced features and priority support.
                {orgPremiumAccess ? (
                  <span className="text-green-600 font-medium"> Your organization has premium access!</span>
                ) : (
                  <span className="text-muted-foreground"> Organization admins can upgrade for everyone.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button onClick={handlePurchase} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  {purchasing
                    ? 'Redirecting to checkout...'
                    : premiumAccess.hasAccess
                      ? 'Already Premium'
                      : 'Purchase Premium'}
                </Button>
              </div>

              {purchaseResult && (
                <div
                  className={`p-4 rounded-md border ${
                    purchaseResult.status === 'ok'
                      ? 'bg-muted/50 border-border text-green-700'
                      : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <pre className="text-xs overflow-auto">{JSON.stringify(purchaseResult, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization Status */}
          {organization && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge variant={organization.plan === 'premium' ? 'default' : 'secondary'} className="h-5 text-xs">
                    {organization.plan || 'free'}
                  </Badge>
                </div>
                {organization.subscriptionStart && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subscription Start</span>
                    <span className="text-sm">{new Date(organization.subscriptionStart).toLocaleDateString()}</span>
                  </div>
                )}
                {organization.subscriptionEnd && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subscription End</span>
                    <span className="text-sm">{new Date(organization.subscriptionEnd).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Your Subscription */}
          {appMembership && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Your Subscription
                </CardTitle>
                <CardDescription>Manage your subscription and billing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg space-y-3">
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
                          className="h-5 text-xs"
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

                  <Separator />

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
              </CardContent>
            </Card>
          )}

          {/* Debug Information */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>Complete membership and access data for debugging</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Premium Access Status</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                  {JSON.stringify({ premiumAccess, orgPremiumAccess }, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Active Membership</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-64">
                  {JSON.stringify(appMembership, null, 2)}
                </pre>
              </div>

              {organization && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Organization Data</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                    {JSON.stringify(organization, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
