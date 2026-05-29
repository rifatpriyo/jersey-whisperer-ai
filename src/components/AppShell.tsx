import type { ReactNode } from "react";
import { AppSidebar, MobileNav } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-6 py-3 sticky top-0 z-30">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">JerseyBecho AI</span> · Inventory intelligence
          </div>
          <ThemeToggle />
        </header>
        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-background">
          <div className="text-sm font-semibold">JerseyBecho AI</div>
          <ThemeToggle />
        </div>
        <MobileNav />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-300">
          {children}
        </main>
        <footer className="border-t border-border px-4 md:px-8 py-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">JerseyBecho AI</span> · Built for Infinity
          AI BuildFest 2026 · Online Commerce track
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
