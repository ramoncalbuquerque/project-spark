import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EnrichedRitual } from "@/hooks/useRituals";
import { FREQ_LABEL } from "@/hooks/useRituals";

export default function RitualCard({ ritual }: { ritual: EnrichedRitual }) {
  const navigate = useNavigate();
  const pending = ritual.lastOccurrence?.pendingCount ?? 0;
  const maxAvatars = 4;
  const visibleMembers = ritual.members.slice(0, maxAvatars);
  const extraCount = ritual.members.length - maxAvatars;

  return (
    <button
      onClick={() => navigate(`/app/ritual/${ritual.id}`)}
      className="w-full text-left bg-white border border-[hsl(var(--border))] rounded-xl p-4 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{ritual.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {FREQ_LABEL[ritual.frequency ?? ""] ?? ritual.frequency ?? ""}
          </p>
        </div>
        {pending > 0 && (
          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-none text-[10px] px-1.5 py-0 h-4 font-medium shrink-0">
            {pending} pendente{pending !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Stacked avatars */}
      <div className="flex items-center">
        <div className="flex -space-x-1.5">
          {visibleMembers.map((m) => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-white">
              <AvatarImage src={m.avatar_url ?? undefined} />
              <AvatarFallback className="text-[9px] bg-muted">
                {(m.full_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {extraCount > 0 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[9px] text-muted-foreground font-medium">
              +{extraCount}
            </div>
          )}
        </div>
      </div>

      {/* Last occurrence info */}
      <p className="text-[11px] text-muted-foreground">
        {ritual.lastOccurrence
          ? `Última: ${format(new Date(ritual.lastOccurrence.date), "d MMM yyyy", { locale: ptBR })} · ${pending} pendente${pending !== 1 ? "s" : ""}`
          : "Nenhuma ocorrência ainda"}
      </p>
    </button>
  );
}
