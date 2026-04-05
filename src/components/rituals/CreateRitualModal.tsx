import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Person = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  type: "profile" | "contact";
};

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
  const [selectedMembers, setSelectedMembers] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [allPeople, setAllPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, department"),
      supabase.from("contacts").select("id, full_name, department"),
    ]).then(([profilesRes, contactsRes]) => {
      const profiles: Person[] = (profilesRes.data ?? []).map((p) => ({
        id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, department: p.department, type: "profile",
      }));
      const contacts: Person[] = (contactsRes.data ?? []).map((c) => ({
        id: c.id, full_name: c.full_name, avatar_url: null, department: c.department, type: "contact",
      }));
      setAllPeople([...profiles, ...contacts]);
    });
  }, [open]);

  // Available departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const p of allPeople) {
      if (p.department) depts.add(p.department);
    }
    return [...depts].sort();
  }, [allPeople]);

  const filtered = allPeople.filter(
    (p) =>
      p.id !== user?.id &&
      !selectedMembers.some((s) => s.id === p.id) &&
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const addDepartment = (dept: string) => {
    const deptPeople = allPeople.filter(
      (p) => p.department === dept && p.id !== user?.id && !selectedMembers.some((s) => s.id === p.id)
    );
    if (deptPeople.length > 0) {
      setSelectedMembers((s) => [...s, ...deptPeople]);
    }
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    // Only profile IDs can be ritual_members (FK constraint)
    const profileIds = selectedMembers.filter((m) => m.type === "profile").map((m) => m.id);
    onCreate({ name: name.trim(), frequency, memberIds: profileIds });
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
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">{selectedMembers.length} membro{selectedMembers.length !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <span key={m.id} className={`flex items-center gap-1 text-xs rounded-full px-2 py-1 ${m.type === "contact" ? "bg-muted" : "bg-accent"}`}>
                    {(m.full_name ?? "?").split(" ")[0]}
                    <button onClick={() => setSelectedMembers((s) => s.filter((x) => x.id !== m.id))}>
                      <X size={12} className="text-muted-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Department bulk add */}
          {departments.length > 0 && (
            <Select onValueChange={addDepartment}>
              <SelectTrigger className="h-8 text-xs">
                <Users size={14} className="mr-1.5 text-muted-foreground" />
                <span className="text-muted-foreground">Adicionar departamento</span>
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept} className="text-xs">
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input placeholder="Buscar membros..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && filtered.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filtered.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedMembers((s) => [...s, p]); setSearch(""); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className={`text-[9px] ${p.type === "contact" ? "bg-muted-foreground/20" : ""}`}>
                      {(p.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{p.full_name ?? "Sem nome"}</span>
                  {p.type === "contact" && (
                    <span className="text-[9px] text-muted-foreground ml-auto">sem conta</span>
                  )}
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
