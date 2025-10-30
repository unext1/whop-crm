import type { loader as rootLoader } from '~/root';
import { useRouteLoaderData } from 'react-router';

export function useRootData() {
  return useRouteLoaderData<typeof rootLoader>('root');
}
