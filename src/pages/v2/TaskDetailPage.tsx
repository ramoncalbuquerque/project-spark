import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Trash2, Plus, Paperclip, Upload, ChevronDown,
  GripVertical, CalendarIcon, X, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useAgendaItems } from "@/hooks/useAgendaItems";
import { useAttachments } from "@/hooks/useAttachments";
import AssigneeSelector from "@/components/shared/AssigneeSelector";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente", color: "#94A3B8" },
  { value: "in_progress", label: "Em andamento", color: "#3B82F6" },
  { value: "completed", label: "Concluído", color: "#22C55E" },
  { value: "cancelled", label: "Cancelado", color: "#EF4444" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const TYPE_OPTIONS = [
  { value: "task", label: "Tarefa" },
  { value: "meeting", label: "Reunião" },
  { value: "event", label: "Evento" },
];

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { card, isLoading, canEditAll, updateCard, updateAssignees, deleteCard } = useTaskDetail(id);
  const { history } = useTaskHistory(id);
  const { items: checklistItems, addItem, toggleItem, deleteItem } = useAgendaItems(id ?? null);
  const { attachments, uploadFile, deleteFile, getDownloadUrl } = useAttachments(id ?? null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [newCheckItem, setNewCheckItem] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card) {
      setTitleDraft(card.title);
      if (descDraft === null) setDescDraft(card.description ?? "");
    }
  }, [card]);

  if (isLoading || !card) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {isLoading ? "Carregando..." : "Tarefa não encontrada"}
      </div>
    );
  }

  const completedCount = checklistItems.filter((i) => i.is_completed).length;
  const totalCount = checklistItems.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === card.status) ?? STATUS_OPTIONS[0];

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft !== card.title) {
      updateCard.mutate({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    const val = (descDraft ?? "").trim() || null;
    if (val !== (card.description ?? null)) {
      updateCard.mutate({ description: val });
    }
  };

  const handleAddCheckItem = () => {
    if (!newCheckItem.trim()) return;
    addItem.mutate(newCheckItem.trim());
    setNewCheckItem("");
  };

  const handleUpload = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="flex-1" />

        {/* Status selector */}
        <Select
          value={card.status}
          onValueChange={(v) => updateCard.mutate({ status: v })}
        >
          <SelectTrigger className="h-7 w-auto gap-1 border-none shadow-none text-xs font-medium px-2" style={{ color: currentStatus.color }}>
            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: currentStatus.color }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority */}
        {canEditAll ? (
          <Select
            value={card.priority}
            onValueChange={(v) => updateCard.mutate({ priority: v })}
          >
            <SelectTrigger className="h-7 w-auto gap-1 border-none shadow-none text-xs font-medium px-2 text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-[10px] h-6">
            {PRIORITY_OPTIONS.find((p) => p.value === card.priority)?.label ?? card.priority}
          </Badge>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-5 pt-4">
        {/* Title */}
        {canEditAll && editingTitle ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
            className="text-lg font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0"
          />
        ) : (
          <h1
            className={cn("text-lg font-medium text-foreground", canEditAll && "cursor-text")}
            onClick={() => canEditAll && setEditingTitle(true)}
          >
            {card.title}
          </h1>
        )}

        {/* Description */}
        {canEditAll ? (
          <textarea
            value={descDraft ?? ""}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={handleSaveDesc}
            placeholder="Adicionar descrição..."
            className="w-full text-[13px] text-foreground bg-transparent resize-none outline-none min-h-[60px] placeholder:text-muted-foreground"
          />
        ) : card.description ? (
          <p className="text-[13px] text-foreground whitespace-pre-wrap">{card.description}</p>
        ) : null}

        {/* Reference chips */}
        {(card.project_name || card.ritual_name) && (
          <div className="flex flex-wrap gap-1.5">
            {card.project_name && (
              <button
                onClick={() => navigate(`/app/project/${card.project_id}`)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
              >
                @{card.project_name}
              </button>
            )}
            {card.ritual_name && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[hsl(30_80%_55%/0.1)] text-[#C2410C] font-medium">
                @{card.ritual_name}
              </span>
            )}
          </div>
        )}

        {/* ─── CHECKLIST ─── */}
        <section className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare size={16} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              Checklist ({completedCount}/{totalCount})
            </span>
          </div>
          {totalCount > 0 && (
            <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#22C55E] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <div className="space-y-0.5">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group relative min-h-[36px]">
                <GripVertical size={14} className="text-muted-foreground/40 shrink-0 cursor-grab" />
                <button
                  className="flex items-center gap-2 flex-1 text-left py-1"
                  onClick={() => toggleItem.mutate({ id: item.id, is_completed: !item.is_completed })}
                >
                  <Checkbox checked={item.is_completed} className="h-5 w-5 pointer-events-none" />
                  <span className={cn(
                    "text-[13px]",
                    item.is_completed && "line-through text-muted-foreground"
                  )}>
                    {item.content}
                  </span>
                </button>
                <button
                  onClick={() => deleteItem.mutate(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-destructive transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Plus size={14} className="text-muted-foreground shrink-0" />
            <Input
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()}
              placeholder="Adicionar item..."
              className="border-none shadow-none h-8 text-[13px] px-0 focus-visible:ring-0"
            />
          </div>
        </section>

        {/* ─── HISTORY ─── */}
        {history.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Histórico</h3>
            <div className="relative pl-4 border-l-2 border-muted space-y-3">
              {history.map((h) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border-2 border-background" />
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(h.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
                    {h.updated_by_name && ` — ${h.updated_by_name}`}
                  </p>
                  {h.status_at_time && (
                    <Badge variant="outline" className="text-[10px] h-4 mt-0.5">
                      {STATUS_OPTIONS.find((s) => s.value === h.status_at_time)?.label ?? h.status_at_time}
                    </Badge>
                  )}
                  {h.context_note && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{h.context_note}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── METADATA ─── */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Metadados</h3>
          <div className="space-y-3 text-sm">
            {canEditAll && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Tipo</span>
                <Select value={card.card_type} onValueChange={(v) => updateCard.mutate({ card_type: v })}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <AssigneeSelector
              selectedProfiles={card.assignees.map((a) => a.id)}
              selectedContacts={card.contact_assignees.map((a) => a.id)}
              onChangeProfiles={(pIds) =>
                updateAssignees.mutate({
                  profileIds: pIds,
                  contactIds: card.contact_assignees.map((a) => a.id),
                })
              }
              onChangeContacts={(cIds) =>
                updateAssignees.mutate({
                  profileIds: card.assignees.map((a) => a.id),
                  contactIds: cIds,
                })
              }
            />

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Prazo</span>
              {canEditAll ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <CalendarIcon size={12} />
                      {card.end_date ? format(new Date(card.end_date), "dd/MM/yyyy") : "Sem prazo"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={card.end_date ? new Date(card.end_date) : undefined}
                      onSelect={(d) => updateCard.mutate({ end_date: d?.toISOString() ?? null })}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="text-xs">
                  {card.end_date ? format(new Date(card.end_date), "dd/MM/yyyy") : "—"}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground text-xs">Anexos</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleUpload}>
                  <Upload size={12} /> Enviar
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 text-xs group">
                      <Paperclip size={12} className="text-muted-foreground shrink-0" />
                      <a
                        href={getDownloadUrl(att.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary truncate flex-1 hover:underline"
                      >
                        {att.file_name}
                      </a>
                      <button
                        onClick={() => deleteFile.mutate(att)}
                        className="opacity-0 group-hover:opacity-100 text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Delete */}
        {canEditAll && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
                <Trash2 size={16} /> Excluir tarefa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A tarefa e todos os seus itens serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteCard.mutate(undefined, { onSuccess: () => navigate("/app/feed") })}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
