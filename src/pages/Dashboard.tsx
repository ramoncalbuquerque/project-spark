import { Calendar } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
      <Calendar className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Seu calendário aparecerá aqui
      </h2>
      <p className="text-sm text-muted-foreground">
        Em breve você poderá visualizar suas demandas no calendário.
      </p>
    </div>
  );
};

export default Dashboard;
