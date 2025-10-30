import type { LoaderFunctionArgs } from 'react-router';
import { eventStream } from 'remix-utils/sse/server';

import { emitter } from '~/services/events.server';

export const loader = ({ request, params }: LoaderFunctionArgs) => {
  const chanel = params['*'];
  if (!chanel) throw Error('not found');

  return eventStream(request.signal, (send) => {
    const handle = (data: string) => {
      send({ event: chanel, data });
    };

    emitter.on(chanel, handle);

    return () => {
      emitter.off(chanel, handle);
    };
  });
};
