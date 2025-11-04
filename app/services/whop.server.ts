import Whop from '@whop/sdk';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { env } from './env.server';

// Premium product ID - update this to match your premium product
export const PREMIUM_PRODUCT_ID = 'prod_refsXJqTNDzUT';

export const whopSdk = new Whop({
  appID: env.WHOP_APP_ID,
  apiKey: env.WHOP_API_KEY,
  webhookKey: Buffer.from(env.WHOP_WEBHOOK_SECRET || '', 'utf8').toString('base64'),
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
  return authorizedUser.user;
};

export const getPublicUser = async (userId: string) => {
  const user = await whopSdk.users.retrieve(userId);
  return user;
};

export const requireUser = async (request: Request, companyId: string) => {
  // First check access level
  const { userId } = await verifyWhopToken(request);

  // Check if user has access to the company (bizz)
  const access = await hasAccess({ request, companyId });
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
 */
export const hasOrganizationPremiumAccess = async (companyId: string): Promise<boolean> => {
  try {
    const organization = await db.query.organizationTable.findFirst({
      where: eq(organizationTable.id, companyId),
    });

    return organization?.plan === 'premium';
  } catch (error) {
    console.error(`Error checking organization premium access for ${companyId}:`, error);
    return false;
  }
};

/**
 * Checks if a user has premium access either individually or through their organization
 */
export const hasPremiumAccess = async ({
  request,
  companyId,
  userId,
}: {
  request: Request;
  companyId: string;
  userId?: string;
}): Promise<{ hasAccess: boolean; accessLevel: 'individual' | 'organization' | 'none' }> => {
  try {
    // First check individual user access to the premium product
    const userToCheck = userId || (await verifyWhopToken(request)).userId;
    const individualAccess = await whopSdk.users.checkAccess(PREMIUM_PRODUCT_ID, { id: userToCheck });

    if (individualAccess.has_access && individualAccess.access_level === 'customer') {
      return { hasAccess: true, accessLevel: 'individual' };
    }

    // Then check organization-level access
    const orgAccess = await hasOrganizationPremiumAccess(companyId);
    if (orgAccess) {
      return { hasAccess: true, accessLevel: 'organization' };
    }

    return { hasAccess: false, accessLevel: 'none' };
  } catch (error) {
    console.error('Error checking premium access:', error);
    return { hasAccess: false, accessLevel: 'none' };
  }
};
