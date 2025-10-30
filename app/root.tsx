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

export const links: Route.LinksFunction = () => {
  return [{ rel: 'stylesheet', href: tailwindStyleSheetUrl }].filter(Boolean);
};

export const loader = () => {
  const colorScheme = 'system';

  return data({
    colorScheme,
  });
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className="antialiased min-h-screen h-screen" style={{ colorScheme }} data-theme={colorScheme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen h-screen flex flex-col">
        <div className="flex-1 flex flex-col">
          <ToastProvider>
            <Toaster />
            <NuqsAdapter>{children}</NuqsAdapter>
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
