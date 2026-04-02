import { Users } from "lucide-react";

const Teams = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
      <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Gestão de Times
      </h2>
      <p className="text-sm text-muted-foreground">
        Em breve você poderá criar e gerenciar seus times aqui.
      </p>
    </div>
  );
};

export default Teams;
