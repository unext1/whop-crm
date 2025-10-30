import { requireUser } from '~/services/whop.server';
import type { Route } from './+types';

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { experienceId } = params;
  console.log(experienceId);
  console.log(request.headers);
  const user = await requireUser(request, experienceId);
  console.log(user);
  return { user };
};

const ExperiencePage = () => {
  return <div>ExperiencePage</div>;
};

export default ExperiencePage;
