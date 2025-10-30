import { useLoaderData, useLocation, useRevalidator } from 'react-router';
import { useEffect, useRef } from 'react';
import { useEventSource } from 'remix-utils/sse/react';

export const useLiveLoader = <T,>() => {
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const path = pathname.replace('/', '');
  const previousDataRef = useRef<string | null>(null);

  const data = useEventSource(`/events/${path}`, {
    event: path
  });

  useEffect(() => {
    if (data && data !== previousDataRef.current) {
      previousDataRef.current = data;
      void revalidate();
    }
  }, [data, revalidate]);

  return useLoaderData<T>();
};
