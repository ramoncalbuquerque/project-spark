import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import AssigneeSelector from "@/components/shared/AssigneeSelector";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description?: string;
    start_date: string;
    assignee_profile_ids: string[];
    assignee_contact_ids: string[];
  }) => void;
  loading?: boolean;
}

export default function CreateMeetingModal({ open, onClose, onCreate, loading }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState("09:00");
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);

  const handleCreate = () => {
    if (!title.trim()) return;
    const [h, m] = time.split(":").map(Number);
    const startDate = new Date(date);
    startDate.setHours(h, m, 0, 0);

    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate.toISOString(),
      assignee_profile_ids: profileIds,
      assignee_contact_ids: contactIds,
    });
    setTitle("");
    setDescription("");
    setDate(new Date());
    setTime("09:00");
    setProfileIds([]);
    setContactIds([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Reunião</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Título da reunião *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="Descrição / pauta (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start text-left text-sm h-9">
                  <CalendarIcon size={14} className="mr-2" />
                  {format(date, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-28 h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Participantes</label>
            <AssigneeSelector
              selectedProfiles={profileIds}
              selectedContacts={contactIds}
              onChangeProfiles={setProfileIds}
              onChangeContacts={setContactIds}
            />
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={handleCreate}
            disabled={!title.trim() || loading}
          >
            Criar Reunião
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
