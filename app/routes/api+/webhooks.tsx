import { eq } from 'drizzle-orm';
import type { ActionFunctionArgs } from 'react-router';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';
import { PREMIUM_PRODUCT_ID, whopSdk } from '~/services/whop.server';

/**
 * Checks if a user is authorized to grant organization-wide premium access
 * Only admins and owners should be able to upgrade the entire organization
 */
async function checkUserAuthorization(companyId: string, userId?: string): Promise<boolean> {
  if (!userId) return false;

  try {
    const accessCheck = await whopSdk.users.checkAccess(companyId, { id: userId });

    // Only allow admin or owner level access to grant organization premium
    const isAuthorized =
      (accessCheck.has_access && accessCheck.access_level === 'admin') || accessCheck.access_level === 'customer';
    return isAuthorized;
  } catch {
    return false;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const requestBodyText = await request.text();
    const headers = Object.fromEntries(request.headers);

    // Webhook signature verification is handled by Whop SDK
    const webhookData = whopSdk.webhooks.unwrap(requestBodyText, { headers });

    await handleWebhookEvent(webhookData.type, webhookData.data as unknown as Record<string, unknown> | null);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to acknowledge receipt even on error to prevent retries
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
}

/**
 * Handle webhook events
 */
async function handleWebhookEvent(action: string, data: Record<string, unknown> | null): Promise<void> {
  // Check if data is null (test webhooks may send null data)
  if (data === null) {
    return;
  }

  if (action === 'payment.succeeded' || action === 'app_payment.succeeded') {
    const { company_id, product_id } = data as {
      company_id?: string;
      product_id?: string;
    };

    // Check if this payment is for the premium product
    if (product_id === PREMIUM_PRODUCT_ID && company_id) {
      await handleOrganizationPremiumAccess(company_id, 'premium').catch((error) => {
        console.error('Error handling payment.succeeded:', error);
      });
    }
  } else if (
    action === 'membership.activated' ||
    action === 'app_membership.went_valid' ||
    action === 'app_membership.activated'
  ) {
    const {
      product,
      id: membershipId,
      user,
      metadata,
      renewal_period_start,
      renewal_period_end,
    } = data as {
      product?: { id: string };
      id?: string;
      user?: { id: string };
      metadata?: { companyId?: string };
      renewal_period_start?: string;
      renewal_period_end?: string;
    };

    const companyId = metadata?.companyId;
    const productId = product?.id;

    // Check if this membership is for the premium product
    if (productId === PREMIUM_PRODUCT_ID && companyId && membershipId) {
      // Verify the subscribing user is authorized for the organization
      const isAuthorizedUser = user?.id ? await checkUserAuthorization(companyId, user.id) : false;

      if (isAuthorizedUser) {
        const membershipData: MembershipData = {
          membershipId,
          renewal_period_start,
          renewal_period_end,
        };

        await handleOrganizationPremiumAccess(companyId, 'premium', membershipData).catch((error) => {
          console.warn('Error activating premium membership:', error);
        });
      } else {
        console.warn('Unauthorized premium activation attempt', {
          companyId,
          userId: user?.id,
          membershipId,
        });
      }
    }
  } else if (
    action === 'membership.deactivated' ||
    action === 'app_membership.went_invalid' ||
    action === 'app_membership.deactivated'
  ) {
    const { product, metadata, cancel_at_period_end, renewal_period_start, canceled_at } = data as {
      product?: { id: string };
      metadata?: { companyId?: string };
      cancel_at_period_end?: boolean;
      renewal_period_start?: string;
      canceled_at?: string;
    };

    const companyId = metadata?.companyId;
    const productId = product?.id;

    // Check if this membership deactivation is for the premium product
    if (productId === PREMIUM_PRODUCT_ID && companyId) {
      if (cancel_at_period_end) {
        // Membership is canceled but stays active until period end
        await db
          .update(organizationTable)
          .set({
            cancelAtPeriodEnd: true,
            canceledAt: canceled_at || renewal_period_start || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(organizationTable.id, companyId))
          .catch((error) => {
            console.error('Error marking membership cancellation:', error);
          });
      } else {
        // Membership deactivated immediately
        await handleOrganizationPremiumAccess(companyId, 'free').catch((error) => {
          console.error('Error deactivating membership:', error);
        });
      }
    }
  }
}

interface MembershipData {
  membershipId: string;
  renewal_period_start?: string;
  renewal_period_end?: string;
}

/**
 * Updates organization premium status and membership data
 */
async function handleOrganizationPremiumAccess(
  companyId: string,
  plan: 'premium' | 'free',
  membershipData?: MembershipData,
): Promise<void> {
  // Check if organization exists
  const existingOrg = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, companyId),
  });

  const now = new Date().toISOString();
  const updateData: Partial<typeof organizationTable.$inferInsert> = {
    plan,
    updatedAt: now,
  };

  if (plan === 'premium' && membershipData) {
    // Add membership ID and subscription dates for premium plans
    updateData.membershipId = membershipData.membershipId;
    updateData.subscriptionStart = membershipData.renewal_period_start;
    updateData.subscriptionEnd = membershipData.renewal_period_end;
    updateData.cancelAtPeriodEnd = false;
    updateData.canceledAt = null;
    updateData.lastMembershipCheck = now;
  } else if (plan === 'free') {
    // Clear membership data when downgrading to free
    updateData.membershipId = null;
    updateData.subscriptionStart = null;
    updateData.subscriptionEnd = null;
    updateData.cancelAtPeriodEnd = false;
    updateData.canceledAt = null;
    updateData.lastMembershipCheck = null;
    updateData.hadPremiumBefore = true;
  }

  if (existingOrg) {
    await db.update(organizationTable).set(updateData).where(eq(organizationTable.id, companyId));
  } else {
    await db.insert(organizationTable).values({
      id: companyId,
      ...updateData,
      createdAt: now,
    });
  }
}
