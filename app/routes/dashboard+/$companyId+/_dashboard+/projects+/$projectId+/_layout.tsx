import { Outlet } from 'react-router';
import type { Route } from './+types/_layout';
import { requireUser } from '~/services/whop.server';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  await requireUser(request, params.companyId);
  return {};
};

const ProjectLayout = () => {
  return <Outlet />;
};

export default ProjectLayout;
