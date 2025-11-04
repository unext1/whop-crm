'use client';
import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { ExternalLink, CreditCard, Calendar, User, Package } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { hasOrganizationPremiumAccess, hasPremiumAccess, PREMIUM_PRODUCT_ID, requireUser, verifyWhopToken, whopSdk } from '~/services/whop.server';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import type { Route } from './+types/billing';
import { env } from '~/services/env.server';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  await requireUser(request, companyId);
  const { userId } = await verifyWhopToken(request);
  
  // Fetch all memberships for this company
  const memberships = await whopSdk.memberships.list({ company_id: companyId });
  
  // Check premium access
  const premiumAccess = await hasPremiumAccess({ request, companyId, userId });
  const orgPremiumAccess = await hasOrganizationPremiumAccess(companyId);
  
  // Fetch organization details
  const organization = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  return {
    companyId,
    userId,
    memberships: memberships.data || [],
    premiumAccess,
    orgPremiumAccess,
    organization,
    whopAppId: env.WHOP_APP_ID,
    premiumPlanId: env.WHOP_PREMIUM_PLAN_ID,
    premiumProductId: PREMIUM_PRODUCT_ID,
  };
};

const BillingPage = () => {
  const { 
    memberships, 
    premiumAccess, 
    orgPremiumAccess, 
    organization,
    whopAppId,
    premiumPlanId,
    premiumProductId,
  } = useLoaderData<typeof loader>();
  
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  const handlePurchase = async (planId: string) => {
    setPurchasing(true);
    setPurchaseResult(null);
    
    try {
      // Dynamically import iframe SDK (client-side only)
      const { createSdk } = await import('@whop/iframe');
      const iframeSdk = createSdk({ appId: whopAppId });
      
      const result = await iframeSdk.inAppPurchase({ planId });
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

  // Filter memberships by status
  const activeMemberships = memberships.filter(m => 
    ['active', 'trialing', 'completed'].includes(m.status)
  );
  const premiumMemberships = memberships.filter(m => 
    (m as any).product?.id === premiumProductId
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Billing & Subscriptions</h1>
          {premiumAccess.hasAccess && (
            <Badge variant="default">
              Premium {premiumAccess.accessLevel === 'organization' ? '(Organization)' : '(Individual)'}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Purchase Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Premium</CardTitle>
              <CardDescription>
                Get access to advanced features and priority support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button 
                  onClick={() => handlePurchase(premiumPlanId)}
                  disabled={purchasing || premiumAccess.hasAccess}
                  className="gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {purchasing ? 'Opening checkout...' : premiumAccess.hasAccess ? 'Already Premium' : 'Purchase Premium'}
                </Button>
              </div>
              
              {purchaseResult && (
                <div className={`p-4 rounded-md ${
                  purchaseResult.status === 'ok' 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(purchaseResult, null, 2)}
                  </pre>
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
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan:</span>
                    <Badge variant={organization.plan === 'premium' ? 'default' : 'secondary'}>
                      {organization.plan || 'free'}
                    </Badge>
                  </div>
                  {organization.subscriptionStart && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subscription Start:</span>
                      <span className="text-sm">
                        {new Date(organization.subscriptionStart).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {organization.subscriptionEnd && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subscription End:</span>
                      <span className="text-sm">
                        {new Date(organization.subscriptionEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Memberships */}
          {activeMemberships.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Active Memberships ({activeMemberships.length})
                </CardTitle>
                <CardDescription>
                  Manage your active subscriptions and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeMemberships.map((membership) => (
                  <div key={membership.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{(membership as any).product?.title || 'Unknown Product'}</h3>
                          <Badge variant={
                            membership.status === 'active' ? 'default' :
                            membership.status === 'trialing' ? 'secondary' :
                            'outline'
                          }>
                            {membership.status}
                          </Badge>
                        </div>
                        {membership.user && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            {membership.user.name} (@{membership.user.username})
                          </div>
                        )}
                      </div>
                      {membership.manage_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={membership.manage_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                            <ExternalLink className="h-3 w-3" />
                            Billing Portal
                          </a>
                        </Button>
                      )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {membership.renewal_period_start && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Period Start</p>
                            <p className="font-medium">
                              {new Date(membership.renewal_period_start).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {membership.renewal_period_end && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Period End</p>
                            <p className="font-medium">
                              {new Date(membership.renewal_period_end).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {membership.currency && (
                        <div>
                          <p className="text-xs text-muted-foreground">Currency</p>
                          <p className="font-medium uppercase">{membership.currency}</p>
                        </div>
                      )}
                      {membership.cancel_at_period_end && (
                        <div>
                          <Badge variant="destructive">Cancels at period end</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Debug Information */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
              <CardDescription>
                Complete membership and access data for debugging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Premium Access Status</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                  {JSON.stringify({ premiumAccess, orgPremiumAccess }, null, 2)}
                </pre>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">All Memberships ({memberships.length})</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-96">
                  {JSON.stringify(memberships, null, 2)}
                </pre>
              </div>

              {premiumMemberships.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Premium Memberships Only</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-64">
                      {JSON.stringify(premiumMemberships, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {organization && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Organization Data</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                      {JSON.stringify(organization, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Configuration</h4>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                  {JSON.stringify({ 
                    whopAppId, 
                    premiumPlanId,
                    premiumProductId 
                  }, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
