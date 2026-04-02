import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Dashboard = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">🌱 Semear</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {profile?.full_name || "Usuário"}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="p-4">
        <p className="text-muted-foreground">
          Calendário será implementado aqui.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
