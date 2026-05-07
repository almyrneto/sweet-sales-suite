import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pipely — SDR CRM" },
      { name: "description", content: "Lightweight SDR CRM with leads kanban, campaigns and AI outreach." },
      { property: "og:title", content: "Pipely — SDR CRM" },
      { name: "twitter:title", content: "Pipely — SDR CRM" },
      { property: "og:description", content: "Lightweight SDR CRM with leads kanban, campaigns and AI outreach." },
      { name: "twitter:description", content: "Lightweight SDR CRM with leads kanban, campaigns and AI outreach." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/37638862-ab4d-4d62-b8a9-9cdacd3774fa/id-preview-3aea34bd--f7b06ff9-a9b5-4c2f-8925-bc865f4e26a1.lovable.app-1778176751405.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/37638862-ab4d-4d62-b8a9-9cdacd3774fa/id-preview-3aea34bd--f7b06ff9-a9b5-4c2f-8925-bc865f4e26a1.lovable.app-1778176751405.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Page not found</p>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
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
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
