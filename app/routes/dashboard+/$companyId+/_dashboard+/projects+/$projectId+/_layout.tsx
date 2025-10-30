import { redirect, Outlet } from 'react-router';
import type { Route } from './+types/_layout';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { boardMemberTable } from '~/db/kanban-schemas';
import { requireUser } from '~/services/whop.server';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { user } = await requireUser(request, params.companyId);
  const { projectId, companyId } = params;

  const wpUser = await db.query.boardMemberTable.findMany({
    where: eq(boardMemberTable.userId, user.id),
  });

  const userProject = wpUser.map((member) => member.boardId);

  if (!userProject.includes(projectId)) {
    throw redirect(`/dashboard/${companyId}/projects`);
  }

  return {};
};

const ProjectLayout = () => {
  return <Outlet />;
};

export default ProjectLayout;
