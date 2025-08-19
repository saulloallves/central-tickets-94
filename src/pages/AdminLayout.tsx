
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { Toaster } from "@/components/ui/toaster"
import { CrisisAlertBanner } from "@/components/crisis/CrisisAlertBanner"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Crisis Alert Banner - Always visible when there are active crises */}
          <CrisisAlertBanner />
          
          {/* Main content area with proper top padding when crisis banner is shown */}
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
