import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Repeat, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRituals } from "@/hooks/useRituals";
import RitualCard from "@/components/rituals/RitualCard";
import CreateRitualModal from "@/components/rituals/CreateRitualModal";
import { canCreateRitual } from "@/lib/permissions";

export default function RitualsPage() {
  const { rituals, isLoading, userRole, createRitual } = useRituals();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-background z-10">
        <h1 className="text-lg font-semibold text-foreground">Ritualísticas</h1>
        {canCreateRitual(userRole) && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => navigate("/app/import-rituals")}
            >
              <Upload size={14} className="mr-1" /> Importar
            </Button>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={() => setShowCreate(true)}>
              <Plus size={14} className="mr-1" /> Nova
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : rituals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <Repeat size={48} strokeWidth={1.2} />
            <p className="text-sm">Nenhuma ritualística ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rituals.map((r) => <RitualCard key={r.id} ritual={r} />)}
          </div>
        )}
      </div>

      <CreateRitualModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={(input) => createRitual.mutate(input)} loading={createRitual.isPending} />
    </div>
  );
}
