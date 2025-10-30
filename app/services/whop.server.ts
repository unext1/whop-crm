import Whop from '@whop/sdk';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { userTable } from '~/db/schema';
import { env } from './env.server';

export const whopSdk = new Whop({
  appID: env.WHOP_APP_ID,
  apiKey: env.WHOP_API_KEY,
});

export const verifyWhopToken = async (request: Request) => {
  const { userId } = await whopSdk.verifyUserToken(request.headers);
  if (!userId) {
    throw new Response('Authentication required', { status: 401 });
  }
  return { userId };
};

export const hasAccess = async ({ userId, companyId }: { userId: string; companyId: string }) => {
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
  const access = await hasAccess({ userId, companyId });
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
