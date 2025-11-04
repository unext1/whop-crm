import { eq } from 'drizzle-orm';
import type { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { PREMIUM_PRODUCT_ID, whopSdk } from '~/services/whop.server';
import type { Payment } from '@whop/sdk/resources/shared.mjs';

/**
 * Checks if a user is authorized to grant organization-wide premium access
 * Only admins and owners should be able to upgrade the entire organization
 */
async function checkUserAuthorization(companyId: string, userId?: string): Promise<boolean> {
  if (!userId) return false;

  try {
    // Check if user has admin access to the company
    const accessCheck = await whopSdk.users.checkAccess(companyId, { id: userId });

    // Only allow admin or owner level access to grant organization premium
    return accessCheck.has_access && accessCheck.access_level === 'admin';
  } catch (error) {
    console.error('Error checking authorization for user ' + userId + ' in company ' + companyId + ':', error);
    return false;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const requestBodyText = await request.text();
  console.warn('Request body:', requestBodyText);
  const headers = Object.fromEntries(request.headers);
  console.warn('Headers:', headers);
  const webhookData = whopSdk.webhooks.unwrap(requestBodyText, { headers });
  console.warn('Webhook data:', webhookData);

  // Handle the webhook event
  if (webhookData.type === 'payment.succeeded') {
    await handlePaymentSucceeded(webhookData.data);
  }

  await handleWebhookEvent(webhookData.type, webhookData.data);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

function handlePaymentSucceeded(invoice: Payment): Promise<void> {
  // This is a placeholder for a potentially long running operation
  // In a real scenario, you might need to fetch user data, update a database, etc.
  console.warn('[PAYMENT SUCCEEDED]', invoice);
  return Promise.resolve();
}
/**
 * Handle webhook events (extracted for reuse in dev mode)
 */
async function handleWebhookEvent(action: string, data: any) {
  console.log('Processing webhook event: ' + action, data);

  // Check if data is null (test webhooks may send null data)
  if (data === null) {
    console.log('Received ' + action + ' webhook with null data - likely a test webhook');
    return;
  }

  if (action === 'payment.succeeded' || action === 'app_payment.succeeded') {
    const payment = data;
    const { id, final_amount, amount_after_fees, currency, user_id, company_id, product_id } = payment;

    console.log('Payment ' + id + ' succeeded for ' + user_id + ' with amount ' + final_amount + ' ' + currency);

    // Check if this payment is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && company_id) {
      // Update organization to premium plan
      handleOrganizationPremiumAccess(company_id, 'premium').catch(console.error);
    }

    // In React Router v7, we don't have waitUntil, but we can still do async work
    // The response will be sent immediately while background work continues
    potentiallyLongRunningHandler(user_id, final_amount, currency, amount_after_fees).catch(console.error);
  } else if (
    action === 'membership.activated' ||
    action === 'app_membership.went_valid' ||
    action === 'app_membership.activated'
  ) {
    const membership = data;
    const { product_id, id: membershipId, user, metadata } = membership;

    // Use metadata.companyId from checkout session instead of webhook's company field
    // The webhook's company field contains the app owner's company, not the user's company
    const companyId = metadata?.companyId;

    console.log(
      'Membership activated - user: ' + user?.id + ', company from metadata: ' + companyId + ', product: ' + product_id,
    );

    // Check if this membership is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && companyId) {
      // Check if the subscribing user is an admin/owner of the organization
      // This ensures only authorized users can grant organization-wide premium access
      const isAuthorizedUser = await checkUserAuthorization(companyId, user?.id);

      if (isAuthorizedUser) {
        console.log(
          'Authorized user ' + user?.id + ' subscribed - granting organization ' + companyId + ' premium access',
        );

        // Convert webhook timestamp fields to ISO strings
        const membershipData = {
          membershipId,
          renewal_period_start: membership.renewal_period_start
            ? new Date(membership.renewal_period_start * 1000).toISOString()
            : null,
          renewal_period_end: membership.renewal_period_end
            ? new Date(membership.renewal_period_end * 1000).toISOString()
            : null,
        };
        handleOrganizationPremiumAccess(companyId, 'premium', membershipData).catch(console.error);
      } else {
        console.log(
          'User ' +
            user?.id +
            ' subscribed but is not authorized to grant organization access for company ' +
            companyId,
        );
      }
    } else {
      console.log('Membership activated but missing companyId in metadata or not premium product');
    }
  } else if (
    action === 'membership.deactivated' ||
    action === 'app_membership.went_invalid' ||
    action === 'app_membership.deactivated'
  ) {
    const membership = data;
    const { product_id, metadata } = membership;

    // Use metadata.companyId from checkout session
    const companyId = metadata?.companyId;

    console.log('Membership deactivated - company from metadata: ' + companyId + ', product: ' + product_id);

    // Check if this membership deactivation is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && companyId) {
      // Check if there are any other active premium memberships for this organization
      // If not, downgrade to free
      checkAndDowngradeOrganization(companyId).catch(console.error);
    }
  } else {
    // Log other webhook events for debugging
    console.log('Received webhook event: ' + action, data);
  }
}

/**
 * Updates organization to premium plan when a payment succeeds
 */
async function handleOrganizationPremiumAccess(companyId: string, plan: 'premium' | 'free', membershipData?: any) {
  try {
    // Check if organization exists
    const existingOrg = await db.query.organizationTable.findFirst({
      where: eq(organizationTable.id, companyId),
    });

    const updateData: any = {
      plan,
      updatedAt: new Date().toISOString(),
    };

    // Add membership ID if available
    if (membershipData?.membershipId) {
      updateData.membershipId = membershipData.membershipId;
    }

    // Add subscription dates if available
    if (membershipData?.renewal_period_start) {
      updateData.subscriptionStart = membershipData.renewal_period_start;
    }
    if (membershipData?.renewal_period_end) {
      updateData.subscriptionEnd = membershipData.renewal_period_end;
    }

    if (existingOrg) {
      // Update existing organization
      await db.update(organizationTable).set(updateData).where(eq(organizationTable.id, companyId));
      console.log('Updated organization ' + companyId + ' to ' + plan + ' plan');
    } else {
      // Create organization if it doesn't exist
      await db.insert(organizationTable).values({
        id: companyId,
        ...updateData,
        createdAt: new Date().toISOString(),
      });
      console.log('Created organization ' + companyId + ' with ' + plan + ' plan');
    }
  } catch (error) {
    console.error('Error updating organization ' + companyId + ':', error);
    throw error;
  }
}

/**
 * Checks if organization has any active premium memberships and downgrades if none exist
 */
async function checkAndDowngradeOrganization(companyId: string) {
  try {
    // This would require checking Whop API for active memberships
    // For now, we'll keep it simple and rely on membership.activated webhooks
    // to re-activate premium when a new membership is created
    // In a production app, you might want to check the Whop API here
    console.log('Membership deactivated for organization ' + companyId + ' - keeping current plan status');
    return Promise.resolve();
  } catch (error) {
    console.error('Error checking organization ' + companyId + ':', error);
    return Promise.resolve();
  }
}

async function potentiallyLongRunningHandler(
  _user_id: string | null | undefined,
  _amount: number,
  _currency: string,
  _amount_after_fees: number | null | undefined,
) {
  // This is a placeholder for a potentially long running operation
  // In a real scenario, you might need to fetch user data, update a database, etc.
}
