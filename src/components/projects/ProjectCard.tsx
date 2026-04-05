import { useNavigate } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { EnrichedProject } from "@/hooks/useProjects";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-primary/10 text-primary border-none" },
  completed: { label: "Concluído", className: "bg-[#22C55E]/10 text-[#22C55E] border-none" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground border-none" },
};

export default function ProjectCard({ project }: { project: EnrichedProject }) {
  const navigate = useNavigate();
  const { counts } = project;
  const pct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;

  const isOverdue =
    project.target_date &&
    project.status === "active" &&
    parseISO(project.target_date) < new Date();

  const targetLabel = project.target_date
    ? `Prazo: ${format(parseISO(project.target_date), "d MMM yyyy", { locale: ptBR })}`
    : "Sem prazo";

  return (
    <button
      onClick={() => navigate(`/app/project/${project.id}`)}
      className="w-full text-left bg-card border border-border rounded-xl p-4 space-y-2 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
          <span className={`text-[11px] shrink-0 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {targetLabel}
          </span>
        </div>
        <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>

      <Progress value={pct} className="h-1.5" />

      <p className="text-[11px] text-muted-foreground">
        {counts.pending} abertas · {counts.in_progress} em andamento · {counts.completed} concluídas
      </p>
    </button>
  );
}
