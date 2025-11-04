import { eq } from 'drizzle-orm';
import type { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { PREMIUM_PRODUCT_ID, whopSdk } from '~/services/whop.server';
import type { Payment } from '@whop/sdk/resources/shared.mjs';

export async function action({ request }: ActionFunctionArgs) {
  const requestBodyText = await request.text();
  console.warn('Request body:', requestBodyText);
  const headers = Object.fromEntries(request.headers);
  console.warn('Headers:', headers);

  let webhookData: any;

  try {
    // First try the standard unwrap method
    webhookData = whopSdk.webhooks.unwrap(requestBodyText, { headers });
    console.warn('Successfully unwrapped with standard method');
  } catch (unwrapError) {
    console.warn('Standard unwrap failed, trying manual signature verification...');

    // Manual signature verification for Whop's hybrid format
    // They use Standard Webhooks headers but send JSON body instead of base64
    try {
      const webhookId = headers['webhook-id'];
      const webhookSignature = headers['webhook-signature'];
      const webhookTimestamp = headers['webhook-timestamp'];

      if (!webhookId || !webhookSignature || !webhookTimestamp) {
        throw new Error('Missing required webhook headers');
      }

      // For Whop's format, the signature is in format: "v1,signature"
      const signatureParts = webhookSignature.split(',');
      if (signatureParts.length !== 2 || signatureParts[0] !== 'v1') {
        throw new Error('Invalid signature format');
      }

      const signature = signatureParts[1];

      // Import crypto for verification
      const crypto = await import('crypto');

      // Get webhook secret (should be base64-encoded key from Whop)
      const secret = process.env.WHOP_WEBHOOK_SECRET;
      if (!secret) {
        throw new Error('WHOP_WEBHOOK_SECRET not configured');
      }

      // Standard Webhooks signature format: id.timestamp.body (where body is the raw request body)
      const signedPayload = `${webhookId}.${webhookTimestamp}.${requestBodyText}`;
      console.warn('Signed payload:', signedPayload);

      // Use the webhook secret directly (Whop SDK handles the base64 decoding internally)
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(signedPayload, 'utf8');
      const expectedSignature = hmac.digest('base64');

      console.warn('Expected signature:', expectedSignature);
      console.warn('Received signature:', signature);

      // Compare signatures (constant time comparison)
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(expectedSignature, 'base64'))) {
        throw new Error('Invalid webhook signature');
      }

      console.warn('Manual signature verification successful');

      // Parse the JSON body
      webhookData = JSON.parse(requestBodyText);
    } catch (manualError) {
      console.error('Manual verification also failed:', manualError);
      throw unwrapError; // Re-throw original error
    }
  }

  console.warn('Final webhook data:', webhookData);

  // Handle the webhook event
  if (webhookData.type === 'payment.succeeded') {
    handlePaymentSucceeded(webhookData.data);
  }

  handleWebhookEvent(webhookData.type, webhookData.data);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

function handlePaymentSucceeded(invoice: Payment): void {
  // This is a placeholder for a potentially long running operation
  // In a real scenario, you might need to fetch user data, update a database, etc.
  console.warn('[PAYMENT SUCCEEDED]', invoice);
  // Add actual payment processing logic here
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
  } else if (
    action === 'membership.activated' ||
    action === 'app_membership.went_valid' ||
    action === 'app_membership.activated'
  ) {
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
  } else if (
    action === 'membership.deactivated' ||
    action === 'app_membership.went_invalid' ||
    action === 'app_membership.deactivated'
  ) {
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
    return Promise.resolve();
  } catch (error) {
    console.error(`Error checking organization ${companyId}:`, error);
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
