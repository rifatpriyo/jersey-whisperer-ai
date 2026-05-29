import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JerseyBecho AI — 24/7 inventory intelligence for jersey sellers" },
      {
        name: "description",
        content:
          "AI-ready inventory dashboard for Bangladesh jersey SMEs. Track stock, forecast demand, and simulate AI customer replies.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-foreground">
      <div className="text-center">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-4 inline-block underline">Go home</a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-foreground">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <pre className="mt-3 text-xs whitespace-pre-wrap text-muted-foreground">{error.message}</pre>
        <a href="/" className="mt-4 inline-block underline">Reload</a>
      </div>
    </div>
  ),
});

const themeBootScript = `(function(){try{var t=localStorage.getItem('jerseybecho_theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AppShell>
          <Outlet />
        </AppShell>
        <Toaster richColors position="top-right" />
      </StoreProvider>
    </QueryClientProvider>
  );
}
