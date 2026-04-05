import { useState, useRef } from "react";
import { format } from "date-fns";
import { Mic, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import AssigneeSelector from "@/components/shared/AssigneeSelector";
import type { UseMutationResult } from "@tanstack/react-query";

interface QuickCreateBarProps {
  createQuickTask: UseMutationResult<unknown, Error, {
    title: string;
    start_date: string;
    assignee_profile_ids?: string[];
    assignee_contact_ids?: string[];
  }>;
}

export default function QuickCreateBar({ createQuickTask }: QuickCreateBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setExpanded(false);
    setTitle("");
    setDate(new Date());
    setProfileIds([]);
    setContactIds([]);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createQuickTask.mutate(
      {
        title: title.trim(),
        start_date: date.toISOString(),
        assignee_profile_ids: profileIds.length > 0 ? profileIds : undefined,
        assignee_contact_ids: contactIds.length > 0 ? contactIds : undefined,
      },
      { onSuccess: handleClose }
    );
  };

  if (!expanded) {
    return (
      <div className="sticky bottom-14 z-10 px-4 pb-2 pt-1 bg-gradient-to-t from-background via-background to-transparent">
        <div
          className="flex items-center gap-2 h-11 rounded-3xl bg-accent px-4 cursor-text border border-border"
          onClick={() => {
            setExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          <span className="text-sm text-muted-foreground flex-1">Delegar tarefa...</span>
          <Mic size={18} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-14 z-10 px-4 pb-2 pt-1 bg-gradient-to-t from-background via-background to-transparent">
      <div className="rounded-2xl bg-card border border-border p-3 shadow-lg space-y-2">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa"
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button onClick={handleClose} className="p-1 text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <CalendarIcon size={14} />
                {format(date, "dd/MM")}
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

          <AssigneeSelector
            selectedProfiles={profileIds}
            selectedContacts={contactIds}
            onChangeProfiles={setProfileIds}
            onChangeContacts={setContactIds}
            compact
          />

          <Button
            size="sm"
            className="h-8 ml-auto bg-primary hover:bg-primary/90 text-white text-xs"
            onClick={handleCreate}
            disabled={!title.trim() || createQuickTask.isPending}
          >
            {createQuickTask.isPending ? "Criando..." : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
