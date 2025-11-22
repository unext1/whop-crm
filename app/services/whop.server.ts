import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { env } from './env.server';
import Whop from '@whop/sdk';

export const whopSdk = new Whop({
  appID: env.WHOP_APP_ID,
  apiKey: env.WHOP_API_KEY,
  webhookKey: btoa(env.WHOP_WEBHOOK_SECRET),
});

import { WhopServerSdk } from '@whop/api';

export const WhopServerApi = WhopServerSdk({
  appId: env.WHOP_APP_ID ?? 'fallback',
  appApiKey: env.WHOP_API_KEY ?? 'fallback',
  onBehalfOfUserId: env.WHOP_AGENT_USER_ID,
  companyId: env.WHOP_COMPANY_ID,
});

export const verifyWhopToken = async (request: Request) => {
  const { userId } = await whopSdk.verifyUserToken(request.headers);
  if (!userId) {
    throw new Response('Authentication required', { status: 401 });
  }
  return { userId };
};

export const hasAccess = async ({ request, companyId }: { request: Request; companyId: string }) => {
  const { userId } = await verifyWhopToken(request);
  const { access_level, has_access } = await whopSdk.users.checkAccess(companyId, { id: userId });

  return has_access && access_level === 'admin';
};

export const getAuthorizedUserId = async ({
  companyId,
  regularUserId,
}: {
  companyId: string;
  regularUserId: string;
}) => {
  const authorizedUsers = await getAuthorizedUsers(companyId);
  const authorizedUser = authorizedUsers.find((au) => au.user.id === regularUserId);
  if (!authorizedUser) {
    throw new Response('Authorized user not found', { status: 404 });
  }
  return authorizedUser;
};

export const getPublicUser = async (userId: string) => {
  const user = await whopSdk.users.retrieve(userId);
  return user;
};

export const requireUser = async (request: Request, companyId: string) => {
  // First check access level
  const { userId } = await verifyWhopToken(request);

  // Check if user has access to the company (bizz)
  const access = await hasAccess({ request, companyId }); // ACCESS TO THE COMPANY NOT PRODUCT SO ONLY ADMINS AND OWNER
  if (!access) {
    throw new Response('Access denied', { status: 403 });
  }

  const user = await db.query.userTable.findFirst({
    where: eq(userTable.whopUserId, userId),
  });

  if (!user) {
    throw new Response('User not found', { status: 404 });
  }

  return {
    user: user,
  };
};

export const getWhopCompanyMembers = async ({ request, companyId }: { request: Request; companyId: string }) => {
  const isAdmin = await hasAccess({ request, companyId });
  if (!isAdmin) {
    throw new Response('Access denied', { status: 403 });
  }

  const memberListResponse = await whopSdk.members.list({ company_id: companyId });
  return memberListResponse.data;
};

export const getWhopCompanyMembership = async ({ request, companyId }: { request: Request; companyId: string }) => {
  const isAdmin = await hasAccess({ request, companyId });
  if (!isAdmin) {
    throw new Response('Access denied', { status: 403 });
  }

  const memberListResponse = await whopSdk.memberships.list({ company_id: companyId });
  return memberListResponse;
};

export const getWhopMemberById = async (memberId: string) => {
  const member = await whopSdk.members.retrieve(memberId);
  return member;
};

export const getAuthorizedUsers = async (companyId: string, role?: 'admin' | 'moderator' | 'owner') => {
  const params = { company_id: companyId, ...(role && { role }) };
  const authorizedUsers = await whopSdk.authorizedUsers.list(params);
  return authorizedUsers.data;
};

export const getTeamMembers = async (companyId: string) => {
  const authorizedUsers = await getAuthorizedUsers(companyId);

  return authorizedUsers.map((authUser) => ({
    id: authUser.user.id,
    name: authUser.user.name,
    email: authUser.user.email,
    role: authUser.role,
  }));
};

// Helper function to get user email from authorized users list
export const getUserEmail = async (companyId: string, userId: string): Promise<string | null> => {
  const teamMembers = await getTeamMembers(companyId);
  const userFromTeam = teamMembers.find((member) => member.id === userId);
  return userFromTeam?.email || null;
};

export const isAdminCheck = async (request: Request, experienceId: string) => {
  const { userId } = await verifyWhopToken(request);

  const { access_level } = await whopSdk.users.checkAccess(experienceId, { id: userId });
  if (access_level === 'no_access' || access_level !== 'admin') {
    return false;
  }

  return true;
};

/**
 * Checks if an organization has premium access based on database record
 * Returns true if they have active trial, premium subscription, or valid membership
 */
export const hasOrganizationPremiumAccess = async (companyId: string): Promise<boolean> => {
  try {
    const organization = await db.query.organizationTable.findFirst({
      where: eq(organizationTable.id, companyId),
    });

    if (!organization) return false;

    // Check for active trial period (3 days, no credit card required)
    if (organization.trialEnd) {
      const trialEndDate = new Date(organization.trialEnd);
      const now = new Date();
      if (now <= trialEndDate) {
        return true; // Trial is still active
      }
    }

    // If plan is not premium, no access
    if (organization.plan !== 'premium') return false;

    // If no membership ID, no active subscription
    if (!organization.membershipId) return false;

    // Check if subscription has expired based on stored dates
    if (organization.subscriptionEnd) {
      const endDate = new Date(organization.subscriptionEnd);
      const now = new Date();

      if (now > endDate) {
        await downgradeOrganization(companyId);
        return false;
      }
    }

    // Periodic membership validation (check with Whop API every hour)
    const shouldCheckMembership = shouldCheckMembershipStatus(organization);
    if (shouldCheckMembership) {
      const isValid = await validateMembershipWithWhop(organization.membershipId);

      if (!isValid) {
        await downgradeOrganization(companyId);
        return false;
      }

      // Update last check timestamp
      await db
        .update(organizationTable)
        .set({
          lastMembershipCheck: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(organizationTable.id, companyId));
    }

    return true;
  } catch (_error) {
    return false;
  }
};

/**
 * Check if we should validate membership status with Whop API
 * Only check every hour to avoid spamming the API
 */
function shouldCheckMembershipStatus(organization: { lastMembershipCheck?: string | null }): boolean {
  if (!organization.lastMembershipCheck) return true;

  const lastCheck = new Date(organization.lastMembershipCheck);
  const now = new Date();
  const hoursSinceLastCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastCheck >= 12; // Check every 12 hours
}

/**
 * Validate membership with Whop API
 */
async function validateMembershipWithWhop(membershipId: string): Promise<boolean> {
  try {
    const membership = await whopSdk.memberships.retrieve(membershipId);

    // Check if membership is still active
    if (membership.status !== 'active' && membership.status !== 'trialing') {
      return false;
    }

    // If it was canceled but cancelAtPeriodEnd is true, it might still be active
    if (membership.cancel_at_period_end) {
      // Check if we're still within the active period
      const renewalEnd = membership.renewal_period_end;
      if (renewalEnd) {
        const endDate = new Date(renewalEnd);
        const now = new Date();
        if (now > endDate) {
          return false; // Past the period end, should be canceled
        }
      }
    }

    return true;
  } catch (_error) {
    return false; // Assume invalid if we can't check
  }
}

/**
 * Downgrade organization to free plan and clear membership data
 */
async function downgradeOrganization(companyId: string): Promise<void> {
  await db
    .update(organizationTable)
    .set({
      plan: 'free',
      membershipId: null,
      subscriptionStart: null,
      subscriptionEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      lastMembershipCheck: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(organizationTable.id, companyId));
}

/**
 * Checks if a user has premium access either individually or through their organization
 */
export const hasPremiumAccess = async ({
  companyId,
  request,
}: {
  request: Request;
  companyId: string;
  userId?: string;
}): Promise<{ hasAccess: boolean; accessLevel: 'individual' | 'organization' | 'none' }> => {
  try {
    const isAdmin = await hasAccess({ request, companyId });
    if (!isAdmin) {
      throw new Response('Access denied', { status: 403 });
    }
    const orgAccess = await hasOrganizationPremiumAccess(companyId);
    if (orgAccess) {
      return { hasAccess: true, accessLevel: 'organization' };
    }

    // No individual access allowed - organization must subscribe
    return { hasAccess: false, accessLevel: 'none' };
  } catch (_error) {
    return { hasAccess: false, accessLevel: 'none' };
  }
};
