import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card px-4 shrink-0">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <footer className="border-t border-border py-2 shrink-0">
            <p className="text-center text-xs text-muted-foreground">
              Sistema de uso restrito — Dados protegidos conforme LGPD
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
