import { useState } from "react";
import { X, UserPlus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssigneeOptions, type AssigneeOption } from "@/hooks/useAssigneeOptions";
import { useAuth } from "@/contexts/AuthContext";

interface AssigneeSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
}

export default function AssigneeSelector({ selected, onChange, compact }: AssigneeSelectorProps) {
  const { user } = useAuth();
  const { options } = useAssigneeOptions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) =>
    o.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOptions = selected
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as AssigneeOption[];

  const toggle = (o: AssigneeOption) => {
    // Contacts can't be assigned (FK constraint on card_assignees → profiles)
    if (o.type === "contact") return;
    if (selected.includes(o.id)) {
      onChange(selected.filter((s) => s !== o.id));
    } else {
      onChange([...selected, o.id]);
    }
  };

  const getLabel = (o: AssigneeOption) =>
    o.id === user?.id ? "Eu mesmo" : o.full_name;

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <UserPlus size={14} />
            {selectedOptions.length > 0
              ? selectedOptions.map((o) => getLabel(o)).join(", ")
              : "Responsável"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <DropdownBody
            filtered={filtered}
            selected={selected}
            toggle={toggle}
            search={search}
            setSearch={setSearch}
            getLabel={getLabel}
            userId={user?.id}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div>
      <span className="text-muted-foreground text-xs block mb-1">Responsáveis</span>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedOptions.map((o) => (
            <Badge key={o.id} variant="secondary" className="text-[11px] gap-1 pr-1">
              {getLabel(o)}
              <button onClick={() => toggle(o)} className="ml-0.5 hover:text-destructive">
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <UserPlus size={12} /> Adicionar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <DropdownBody
            filtered={filtered}
            selected={selected}
            toggle={toggle}
            search={search}
            setSearch={setSearch}
            getLabel={getLabel}
            userId={user?.id}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DropdownBody({
  filtered,
  selected,
  toggle,
  search,
  setSearch,
  getLabel,
  userId,
}: {
  filtered: AssigneeOption[];
  selected: string[];
  toggle: (o: AssigneeOption) => void;
  search: string;
  setSearch: (s: string) => void;
  getLabel: (o: AssigneeOption) => string;
  userId?: string;
}) {
  return (
    <div className="max-h-60 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="border-none shadow-none h-7 text-xs px-0 focus-visible:ring-0"
        />
      </div>
      <div className="overflow-y-auto max-h-48 p-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
        )}
        {filtered.map((o) => {
          const isSelected = selected.includes(o.id);
          const label = getLabel(o);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o)}
              disabled={o.type === "contact"}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${o.type === "contact" ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"} ${isSelected ? "bg-accent/60" : ""}`}
            >
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={o.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px] bg-muted">
                  {o.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{label}</span>
              {o.type === "contact" && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">sem conta</span>
              )}
              {o.type === "profile" && o.id !== userId && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">conta</span>
              )}
              {isSelected && (
                <span className="text-[10px] text-primary font-medium">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
