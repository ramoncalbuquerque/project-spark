import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Profile = { id: string; full_name: string | null; avatar_url: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; frequency: string; memberIds?: string[] }) => void;
  loading?: boolean;
}

export default function CreateRitualModal({ open, onClose, onCreate, loading }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, full_name, avatar_url").then(({ data }) => setProfiles(data ?? []));
  }, [open]);

  const filtered = profiles.filter(
    (p) =>
      p.id !== user?.id &&
      !selectedMembers.some((s) => s.id === p.id) &&
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), frequency, memberIds: selectedMembers.map((m) => m.id) });
    setName("");
    setFrequency("weekly");
    setSelectedMembers([]);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Ritualística</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Quinzenal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="custom">Personalizada</SelectItem>
            </SelectContent>
          </Select>

          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedMembers.map((m) => (
                <span key={m.id} className="flex items-center gap-1 text-xs bg-accent rounded-full px-2 py-1">
                  {(m.full_name ?? "?").split(" ")[0]}
                  <button onClick={() => setSelectedMembers((s) => s.filter((x) => x.id !== m.id))}>
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Input placeholder="Buscar membros..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && filtered.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filtered.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedMembers((s) => [...s, p]); setSearch(""); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px]">{(p.full_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {p.full_name ?? "Sem nome"}
                </button>
              ))}
            </div>
          )}

          <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleCreate} disabled={!name.trim() || loading}>
            Criar Ritualística
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
