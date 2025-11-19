import { CSRF } from 'remix-utils/csrf/server';

import { env } from '~/services/env.server';
import { cookie } from '~/utils/shared';

export const csrf = new CSRF({
  cookie: cookie({ name: '_csrf' }),
  secret: env.CSRF_SECRET,
});
