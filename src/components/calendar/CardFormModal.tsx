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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Trash2, X } from "lucide-react";
import type { CardWithAssignees } from "@/hooks/useCards";

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
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const myTeams = useMemo(
    () => teams.filter((t) => t.created_by === user?.id),
    [teams, user?.id]
  );

  const editingCardWithAssignees = editingCard as CardWithAssignees | null;

  useEffect(() => {
    if (!isModalOpen) {
      setConfirmDelete(false);
      return;
    }
    if (editingCardWithAssignees) {
      setTitle(editingCardWithAssignees.title);
      setCardType(editingCardWithAssignees.card_type);
      setStartDate(toLocalDatetime(new Date(editingCardWithAssignees.start_date)));
      setEndDate(editingCardWithAssignees.end_date ? toLocalDatetime(new Date(editingCardWithAssignees.end_date)) : "");
      setAllDay(editingCardWithAssignees.all_day);
      setPriority(editingCardWithAssignees.priority);
      setDescription(editingCardWithAssignees.description || "");
      setSelectedProfiles(editingCardWithAssignees.assignees?.map((a) => a.profile_id) || []);
      setSelectedTeams(editingCardWithAssignees.teams?.map((t) => t.team_id) || []);
      setAssignTab(editingCardWithAssignees.teams?.length ? "team" : "person");
    } else {
      setTitle("");
      setCardType("task");
      setStartDate(defaultDate ? toLocalDatetime(defaultDate) : toLocalDatetime(new Date()));
      setEndDate(defaultEndDate ? toLocalDatetime(defaultEndDate) : "");
      setAllDay(false);
      setPriority("medium");
      setDescription("");
      setAssignTab("person");
      setSelectedProfiles([]);
      setSelectedTeams([]);
    }
    setConfirmDelete(false);
  }, [isModalOpen, editingCardWithAssignees, defaultDate, defaultEndDate]);

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
      };
      if (editingCardWithAssignees) {
        await updateCard.mutateAsync({
          id: editingCardWithAssignees.id,
          updates: payload,
          assigneeIds: selectedProfiles,
          teamIds: selectedTeams,
        });
      } else {
        await createCard.mutateAsync({
          card: { ...payload, created_by: user.id },
          assigneeIds: selectedProfiles,
          teamIds: selectedTeams,
        });
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCardWithAssignees) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteCard.mutateAsync(editingCardWithAssignees.id);
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const addProfile = (id: string) => {
    if (id && !selectedProfiles.includes(id)) {
      setSelectedProfiles([...selectedProfiles, id]);
    }
  };

  const removeProfile = (id: string) => {
    setSelectedProfiles(selectedProfiles.filter((p) => p !== id));
  };

  const addTeam = (id: string) => {
    if (id && !selectedTeams.includes(id)) {
      setSelectedTeams([...selectedTeams, id]);
    }
  };

  const removeTeam = (id: string) => {
    setSelectedTeams(selectedTeams.filter((t) => t !== id));
  };

  const availableProfiles = allProfiles.filter((p) => !selectedProfiles.includes(p.id));
  const availableTeams = myTeams.filter((t) => !selectedTeams.includes(t.id));

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

          {/* Assignment - Multi-select */}
          <div className="space-y-2">
            <Label>Atribuir a</Label>
            <Tabs
              value={assignTab}
              onValueChange={(v) => setAssignTab(v as "person" | "team")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="person" className="flex-1">
                  Pessoas {selectedProfiles.length > 0 && `(${selectedProfiles.length})`}
                </TabsTrigger>
                <TabsTrigger value="team" className="flex-1">
                  Times {selectedTeams.length > 0 && `(${selectedTeams.length})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {assignTab === "person" ? (
              <div className="space-y-2">
                {/* Selected chips */}
                {selectedProfiles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedProfiles.map((pid) => {
                      const p = allProfiles.find((pr) => pr.id === pid);
                      return (
                        <Badge key={pid} variant="secondary" className="gap-1 text-xs">
                          {p?.full_name || "Sem nome"}
                          <button onClick={() => removeProfile(pid)} className="ml-0.5 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {/* Add dropdown */}
                {availableProfiles.length > 0 && (
                  <Select value="" onValueChange={addProfile}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Adicionar pessoa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || "Sem nome"} ({p.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Selected chips */}
                {selectedTeams.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTeams.map((tid) => {
                      const t = myTeams.find((tm) => tm.id === tid);
                      return (
                        <Badge key={tid} variant="secondary" className="gap-1 text-xs">
                          {t?.name || "Time"}
                          <button onClick={() => removeTeam(tid)} className="ml-0.5 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {/* Add dropdown */}
                {availableTeams.length > 0 && (
                  <Select value="" onValueChange={addTeam}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Adicionar time..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
