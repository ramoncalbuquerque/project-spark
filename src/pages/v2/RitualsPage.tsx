import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRituals } from "@/hooks/useRituals";
import RitualCard from "@/components/rituals/RitualCard";
import CreateRitualModal from "@/components/rituals/CreateRitualModal";

export default function RitualsPage() {
  const { rituals, isLoading, isLeader, createRitual } = useRituals();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#FAFAF8] z-10">
        <h1 className="text-lg font-semibold text-foreground">Ritualísticas</h1>
        {isLeader && (
          <Button
            size="sm"
            className="bg-[#4F46E5] hover:bg-[#4338CA] h-8 px-3 text-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} className="mr-1" /> Nova
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
        ) : rituals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <Repeat size={48} />
            <p className="text-sm">Nenhuma ritualística ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rituals.map((r) => (
              <RitualCard key={r.id} ritual={r} />
            ))}
          </div>
        )}
      </div>

      <CreateRitualModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(input) => createRitual.mutate(input)}
        loading={createRitual.isPending}
      />
    </div>
  );
}
