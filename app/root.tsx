import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import type { Route } from './+types/root';

import { ToastProvider } from '@radix-ui/react-toast';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { Toaster } from './components/ui/toaster';
import tailwindStyleSheetUrl from './tailwind.css?url';
import { csrf } from './services/csrf.server';
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react';

export const links: Route.LinksFunction = () => {
  return [{ rel: 'stylesheet', href: tailwindStyleSheetUrl }].filter(Boolean);
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  const [csrfToken, cookieHeader] = await csrf.commitToken(request);

  const colorScheme = 'system';

  return data({ csrfToken, colorScheme }, { headers: { 'Set-Cookie': cookieHeader || '' } });
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { colorScheme, csrfToken } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className="antialiased min-h-screen h-screen" style={{ colorScheme }} data-theme={colorScheme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen h-screen flex flex-col">
        <div className="flex-1 flex flex-col max-h-screen overflow-hidden">
          <ToastProvider>
            <Toaster />
            <NuqsAdapter>
              <AuthenticityTokenProvider token={csrfToken}>{children}</AuthenticityTokenProvider>
            </NuqsAdapter>
          </ToastProvider>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack ? (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
};
