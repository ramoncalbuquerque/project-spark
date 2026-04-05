import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { EnrichedProject } from "@/hooks/useProjects";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-green-500/10 text-green-600 border-none" },
  completed: { label: "Concluído", className: "bg-blue-500/10 text-blue-600 border-none" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground border-none" },
};

export default function ProjectCard({ project }: { project: EnrichedProject }) {
  const navigate = useNavigate();
  const { counts } = project;
  const pct = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;

  return (
    <button
      onClick={() => navigate(`/app/project/${project.id}`)}
      className="w-full text-left bg-card border border-border rounded-xl p-4 space-y-2 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground truncate pr-2">{project.name}</p>
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
