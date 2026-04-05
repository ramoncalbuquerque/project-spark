import { ReactNode } from "react";
import logoMunnir from "@/assets/logo-munnir.png";

export const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <img src={logoMunnir} alt="Munnir" className="h-20 w-20 rounded-2xl object-cover" />
          <h1 className="text-3xl font-bold text-primary">Munnir</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de demandas HOT SAT
          </p>
        </div>
        <div className="bg-card rounded-lg border shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
};
