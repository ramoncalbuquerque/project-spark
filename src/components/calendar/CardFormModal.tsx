import { useEffect, useState, useMemo } from "react";
import { useCardModal } from "@/contexts/CardContext";
import { useCards } from "@/hooks/useCards";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAllProfiles, useTeams } from "@/hooks/useTeams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Trash2, X } from "lucide-react";

const CARD_TYPES = [
  { value: "task", label: "📋 Tarefa" },
  { value: "meeting", label: "🤝 Reunião" },
  { value: "project", label: "📁 Projeto" },
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function toLocalDatetime(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** Chip for selected person/team */
const AssignChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 h-8 text-sm text-foreground">
    <span className="truncate max-w-[140px]">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      className="shrink-0 rounded-full hover:bg-muted-foreground/20 p-0.5"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </span>
);

const CardFormModal = () => {
  const { isModalOpen, editingCard, defaultDate, defaultEndDate, closeModal } = useCardModal();
  const { createCard, updateCard, deleteCard } = useCards();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const allProfiles = useAllProfiles();
  const { teams } = useTeams();

  const [title, setTitle] = useState("");
  const [cardType, setCardType] = useState("task");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [assignTab, setAssignTab] = useState<"person" | "team">("person");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const myTeams = useMemo(
    () => teams.filter((t) => t.created_by === user?.id),
    [teams, user?.id]
  );

  // Profiles not yet selected
  const availableProfiles = useMemo(
    () => allProfiles.filter((p) => !selectedProfileIds.includes(p.id)),
    [allProfiles, selectedProfileIds]
  );

  // Teams not yet selected
  const availableTeams = useMemo(
    () => myTeams.filter((t) => !selectedTeamIds.includes(t.id)),
    [myTeams, selectedTeamIds]
  );

  useEffect(() => {
    if (!isModalOpen) {
      setConfirmDelete(false);
      return;
    }
    if (editingCard) {
      setTitle(editingCard.title);
      setCardType(editingCard.card_type);
      setStartDate(toLocalDatetime(new Date(editingCard.start_date)));
      setEndDate(editingCard.end_date ? toLocalDatetime(new Date(editingCard.end_date)) : "");
      setAllDay(editingCard.all_day);
      setPriority(editingCard.priority);
      setDescription(editingCard.description || "");
      setSelectedProfileIds(editingCard.assignees?.map((a) => a.id) ?? []);
      setSelectedTeamIds(editingCard.teams?.map((t) => t.id) ?? []);
      setAssignTab(editingCard.teams?.length ? "team" : "person");
    } else {
      setTitle("");
      setCardType("task");
      setStartDate(defaultDate ? toLocalDatetime(defaultDate) : toLocalDatetime(new Date()));
      setEndDate(defaultEndDate ? toLocalDatetime(defaultEndDate) : "");
      setAllDay(false);
      setPriority("medium");
      setDescription("");
      setAssignTab("person");
      setSelectedProfileIds([]);
      setSelectedTeamIds([]);
    }
    setConfirmDelete(false);
  }, [isModalOpen, editingCard, defaultDate, defaultEndDate]);

  const handleAddProfile = (id: string) => {
    if (id && id !== "none" && !selectedProfileIds.includes(id)) {
      setSelectedProfileIds((prev) => [...prev, id]);
    }
  };

  const handleRemoveProfile = (id: string) => {
    setSelectedProfileIds((prev) => prev.filter((pid) => pid !== id));
  };

  const handleAddTeam = (id: string) => {
    if (id && id !== "none" && !selectedTeamIds.includes(id)) {
      setSelectedTeamIds((prev) => [...prev, id]);
    }
  };

  const handleRemoveTeam = (id: string) => {
    setSelectedTeamIds((prev) => prev.filter((tid) => tid !== id));
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate || !user) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        card_type: cardType,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        all_day: allDay,
        priority,
        description: description.trim() || null,
        assignee_ids: selectedProfileIds,
        team_ids: selectedTeamIds,
      };
      if (editingCard) {
        await updateCard.mutateAsync({ id: editingCard.id, ...payload });
      } else {
        await createCard.mutateAsync({ ...payload, created_by: user.id });
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCard) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteCard.mutateAsync(editingCard.id);
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const getProfileLabel = (id: string) => {
    const p = allProfiles.find((pr) => pr.id === id);
    return p?.full_name || "Sem nome";
  };

  const getTeamLabel = (id: string) => {
    const t = myTeams.find((tm) => tm.id === id);
    return t?.name || "Time";
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        className={
          isMobile
            ? "fixed inset-0 max-w-none w-full h-full rounded-none translate-x-0 translate-y-0 left-0 top-0 flex flex-col"
            : "max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editingCard ? "Editar Card" : "Novo Card"}
          </DialogTitle>
          <DialogDescription>
            {editingCard
              ? "Edite os campos abaixo e salve."
              : "Preencha os campos para criar um novo card."}
          </DialogDescription>
        </DialogHeader>

        <div className={`space-y-4 ${isMobile ? "flex-1 overflow-y-auto" : ""}`}>
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="card-title">Título *</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do card"
              className="text-lg font-semibold h-12"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* All day */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="all-day"
              checked={allDay}
              onCheckedChange={(v) => setAllDay(!!v)}
            />
            <Label htmlFor="all-day" className="cursor-pointer">
              Dia inteiro
            </Label>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start-date">Início *</Label>
              <Input
                id="start-date"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startDate.slice(0, 10) : startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date">Fim</Label>
              <Input
                id="end-date"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endDate.slice(0, 10) : endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignment — Multi-select */}
          <div className="space-y-2">
            <Label>Atribuir a</Label>
            <Tabs
              value={assignTab}
              onValueChange={(v) => setAssignTab(v as "person" | "team")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="person" className="flex-1">
                  Pessoa {selectedProfileIds.length > 0 && `(${selectedProfileIds.length})`}
                </TabsTrigger>
                <TabsTrigger value="team" className="flex-1">
                  Time {selectedTeamIds.length > 0 && `(${selectedTeamIds.length})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {assignTab === "person" ? (
              <div className="space-y-2">
                <Select
                  value="none"
                  onValueChange={handleAddProfile}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecionar pessoa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Selecionar pessoa...</SelectItem>
                    {availableProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || "Sem nome"} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfileIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProfileIds.map((id) => (
                      <AssignChip
                        key={id}
                        label={getProfileLabel(id)}
                        onRemove={() => handleRemoveProfile(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value="none"
                  onValueChange={handleAddTeam}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecionar time..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Selecionar time...</SelectItem>
                    {availableTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTeamIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTeamIds.map((id) => (
                      <AssignChip
                        key={id}
                        label={getTeamLabel(id)}
                        onRemove={() => handleRemoveTeam(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className={`flex gap-2 pt-2 ${isMobile ? "sticky bottom-0 bg-background pb-4" : ""}`}>
          {editingCard && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? "Tem certeza?" : "Excluir"}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={closeModal} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim() || !startDate}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CardFormModal;
