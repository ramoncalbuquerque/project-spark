import { useNavigate } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import logoMunnir from "@/assets/logo-munnir.png";

const AppHeader = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const update = () =>
      setTodayLabel(format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <img src={logoMunnir} alt="Munnir" className="h-8 w-8 rounded-md object-cover" />
        <span className="text-lg font-bold text-primary select-none">
          Munnir
        </span>
        <span className="hidden sm:inline-block text-xs text-muted-foreground capitalize ml-2">
          {todayLabel}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name || ""} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate("/perfil")}>
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AppHeader;
