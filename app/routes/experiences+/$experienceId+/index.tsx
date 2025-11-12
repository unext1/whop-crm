import { requireUser } from '~/services/whop.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { experienceId } = params;
  const user = await requireUser(request, experienceId);
  return { user };
};

const ExperiencePage = () => {
  return <div>ExperiencePage</div>;
};

export default ExperiencePage;
