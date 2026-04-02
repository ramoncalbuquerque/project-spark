import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
      <User className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">
        {profile?.full_name || "Perfil"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Edição de perfil disponível em breve.
      </p>
    </div>
  );
};

export default Profile;
