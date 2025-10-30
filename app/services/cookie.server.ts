import { createCookieSessionStorage } from 'react-router';

interface Toast {
  variant: 'default' | 'destructive';
  title?: string;
  message?: string;
}

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: '_flash',
    sameSite: 'none',
    secure: true
  }
});

export const putToast = async (toast: Toast, headers = new Headers()) => {
  const session = await getSession();
  session.flash('toast', toast);

  headers.set('Set-Cookie', await commitSession(session));
  return headers;
};

export const popToast = async (request: Request, headers = new Headers()) => {
  const session = await getSession(request.headers.get('Cookie'));
  const toast = (session.get('toast') ?? null) as Toast | null;

  headers.set('Set-Cookie', await commitSession(session));

  return { toast, headers };
};
