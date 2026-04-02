import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AppHeader from "@/components/AppHeader";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { CardProvider } from "@/contexts/CardContext";
import CardFormModal from "@/components/calendar/CardFormModal";

const AppLayout = () => {
  return (
    <CalendarProvider>
      <CardProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-muted/30">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <AppHeader />
              <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <CardFormModal />
      </CardProvider>
    </CalendarProvider>
  );
};

export default AppLayout;
