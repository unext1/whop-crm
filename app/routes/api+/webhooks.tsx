import type { Payment } from '@whop/sdk/resources/shared.mjs';
import { eq } from 'drizzle-orm';
import type { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { PREMIUM_PRODUCT_ID, whopSdk } from '~/services/whop.server';

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  try {
    const requestBodyText = await request.text();
    const headers = Object.fromEntries(request.headers);
    const webhookData = whopSdk.webhooks.unwrap(requestBodyText, { headers });

   
    handleWebhookEvent(webhookData.type, webhookData.data);

    console.warn('Webhook data:', webhookData);
   	// Handle the webhook event
   	if (webhookData.type === "payment.succeeded") {
  		handlePaymentSucceeded(webhookData.data)
   	}
    return new Response(JSON.stringify(webhookData), { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
};
async function handlePaymentSucceeded(invoice: Payment) {
  // This is a placeholder for a potentially long running operation
  // In a real scenario, you might need to fetch user data, update a database, etc.
  console.warn("[PAYMENT SUCCEEDED]", invoice);
}
/**
 * Handle webhook events (extracted for reuse in dev mode)
 */
function handleWebhookEvent(action: string, data: any) {
  console.log(`Processing webhook event: ${action}`, data);

  // Check if data is null (test webhooks may send null data)
  if (data === null) {
    console.log(`Received ${action} webhook with null data - likely a test webhook`);
    return;
  }

  if (action === 'payment.succeeded' || action === 'app_payment.succeeded') {
    const payment = data;
    const { id, final_amount, amount_after_fees, currency, user_id, company_id, product_id } = payment;

    console.log(`Payment ${id} succeeded for ${user_id} with amount ${final_amount} ${currency}`);

    // Check if this payment is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && company_id) {
      // Update organization to premium plan
      handleOrganizationPremiumAccess(company_id, 'premium').catch(console.error);
    }

    // In React Router v7, we don't have waitUntil, but we can still do async work
    // The response will be sent immediately while background work continues
    potentiallyLongRunningHandler(user_id, final_amount, currency, amount_after_fees).catch(console.error);
  } else if (action === 'membership.activated' || action === 'app_membership.went_valid' || action === 'app_membership.activated') {
    const membership = data;
    const { product_id, page_id, id: membershipId } = membership;

    // Check if this membership is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && page_id) {
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
      handleOrganizationPremiumAccess(page_id, 'premium', membershipData).catch(console.error);
    }
  } else if (action === 'membership.deactivated' || action === 'app_membership.went_invalid' || action === 'app_membership.deactivated') {
    const membership = data;
    const { product_id, page_id } = membership;

    // Check if this membership deactivation is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && page_id) {
      // Check if there are any other active premium memberships for this organization
      // If not, downgrade to free
      checkAndDowngradeOrganization(page_id).catch(console.error);
    }
  } else {
    // Log other webhook events for debugging
    console.log(`Received webhook event: ${action}`, data);
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
      updatedAt: new Date().toISOString() 
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
      await db
        .update(organizationTable)
        .set(updateData)
        .where(eq(organizationTable.id, companyId));
      console.log(`Updated organization ${companyId} to ${plan} plan`);
    } else {
      // Create organization if it doesn't exist
      await db.insert(organizationTable).values({
        id: companyId,
        ...updateData,
        createdAt: new Date().toISOString(),
      });
      console.log(`Created organization ${companyId} with ${plan} plan`);
    }
  } catch (error) {
    console.error(`Error updating organization ${companyId}:`, error);
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
    console.log(`Membership deactivated for organization ${companyId} - keeping current plan status`);
  } catch (error) {
    console.error(`Error checking organization ${companyId}:`, error);
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
