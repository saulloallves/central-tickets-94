import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { FranqueadoSidebar } from '@/components/FranqueadoSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

interface FranqueadoLayoutProps {
  children: ReactNode;
}

export default function FranqueadoLayout({ children }: FranqueadoLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        {!isMobile && <FranqueadoSidebar />}
        
        <main 
          className="flex-1 transition-all duration-300 overflow-hidden"
          data-main-content
          style={{ 
            marginLeft: isMobile ? '0' : '64px',
            paddingBottom: isMobile ? '80px' : '0'
          }}
        >
          {children}
        </main>

        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}