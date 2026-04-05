import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Network, Upload, Download, ChevronRight, ChevronDown,
  ArrowLeft, User, Phone, Loader2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePeople, type UnifiedPerson } from "@/hooks/usePeople";
import { useOrgImport } from "@/hooks/useOrgImport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef } from "react";

type View = "list" | "orgchart";

const PeoplePage = () => {
  const [view, setView] = useState<View>("list");
  const { profile } = useAuth();
  const isLeader = profile?.role === "leader";

  if (view === "orgchart") return <OrgChartView onBack={() => setView("list")} />;
  return <ListView onOrgChart={() => setView("orgchart")} isLeader={isLeader} />;
};

/* ── List View ── */
function ListView({ onOrgChart, isLeader }: { onOrgChart: () => void; isLeader: boolean }) {
  const navigate = useNavigate();
  const { people, departments, stats, isLoading, refetch } = usePeople();
  const { importCsv, downloadTemplate, isImporting, result } = useOrgImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  // Modal states
  const [accountModal, setAccountModal] = useState<UnifiedPerson | null>(null);
  const [phoneModal, setPhoneModal] = useState<UnifiedPerson | null>(null);

  const filtered = useMemo(() => {
    let list = people;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.full_name.toLowerCase().includes(q));
    }
    if (deptFilter) list = list.filter((p) => p.department === deptFilter);
    return list;
  }, [people, search, deptFilter]);

  // Build tree for department filter
  const tree = useMemo(() => {
    if (!deptFilter) return null;
    const deptPeople = filtered;
    const idMap = new Map<string, UnifiedPerson>();
    const nameMap = new Map<string, UnifiedPerson>();
    for (const p of deptPeople) {
      idMap.set(p.id, p);
      nameMap.set(p.full_name.toLowerCase().trim(), p);
    }

    const childrenMap = new Map<string, UnifiedPerson[]>();
    for (const p of deptPeople) {
      let parentId: string | null = null;
      if (p.superior_id && idMap.has(p.superior_id)) parentId = p.superior_id;
      else if (p.superior_name) {
        const sup = nameMap.get(p.superior_name.toLowerCase().trim());
        if (sup) parentId = sup.id;
      }
      const key = parentId ?? "__root__";
      const list = childrenMap.get(key) ?? [];
      list.push(p);
      childrenMap.set(key, list);
    }
    return childrenMap;
  }, [filtered, deptFilter]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCsv(file);
    if (fileRef.current) fileRef.current.value = "";
    refetch();
  };

  const totalPeople = people.length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOrgChart} className="gap-1.5">
          <Network className="h-4 w-4" /> Organograma
        </Button>
        {isLeader && (
          <>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={isImporting} className="gap-1.5">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="h-4 w-4" /> Modelo
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>

      {/* Counters */}
      {totalPeople > 0 && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          {totalPeople} pessoa{totalPeople !== 1 ? "s" : ""} · {stats.withAccount} com conta · {stats.withoutAccount} sem conta · {stats.withoutPhone} sem telefone
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-border p-3 text-xs space-y-1">
          <span className="text-green-600 font-medium">{result.imported} importado(s)</span>
          {" · "}
          <span className="text-blue-600 font-medium">{result.updated} atualizado(s)</span>
          {result.errors.length > 0 && <p className="text-destructive">{result.errors.length} erro(s)</p>}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {/* Department chips */}
      {departments.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button onClick={() => setDeptFilter(null)} className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!deptFilter ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>
            Todos
          </button>
          {departments.map((d) => (
            <button key={d} onClick={() => setDeptFilter(deptFilter === d ? null : d)} className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${deptFilter === d ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>
              {d}
            </button>
          ))}
        </div>
      )}

      {/* People list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pessoa encontrada</p>
          ) : deptFilter && tree ? (
            // Tree view for department filter
            (tree.get("__root__") ?? []).map((person) => (
              <TreeNode
                key={person.id}
                person={person}
                childrenMap={tree}
                level={0}
                onAccountAction={setAccountModal}
                onPhoneAction={setPhoneModal}
                isLeader={isLeader}
              />
            ))
          ) : (
            // Flat list
            filtered.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onClick={() => person.has_account ? navigate(`/app/feed?person=${person.id}`) : undefined}
                onAccountAction={setAccountModal}
                onPhoneAction={setPhoneModal}
                isLeader={isLeader}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Account modal */}
      {accountModal && (
        <AccountActionModal
          person={accountModal}
          people={people}
          onClose={() => setAccountModal(null)}
          onSuccess={refetch}
        />
      )}

      {/* Phone modal */}
      {phoneModal && (
        <PhoneEditModal
          person={phoneModal}
          onClose={() => setPhoneModal(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}

/* ── Person Card ── */
function PersonCard({
  person,
  onClick,
  onAccountAction,
  onPhoneAction,
  isLeader,
}: {
  person: UnifiedPerson;
  onClick?: () => void;
  onAccountAction: (p: UnifiedPerson) => void;
  onPhoneAction: (p: UnifiedPerson) => void;
  isLeader: boolean;
}) {
  const initials = person.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/60 transition-colors">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={person.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{person.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {person.position || ""}
            {person.position && person.department ? " · " : ""}
            {person.department || ""}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {person.pending_count > 0 && (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5">{person.pending_count}</Badge>
        )}
        {person.overdue_count > 0 && (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5">{person.overdue_count}</Badge>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (!person.has_account && isLeader) onAccountAction(person); }}
          className="p-1"
          title={person.has_account ? "Tem conta" : "Sem conta"}
        >
          <User size={16} className={person.has_account ? "text-[#22C55E]" : "text-[#94A3B8]"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (!person.has_phone && isLeader) onPhoneAction(person); }}
          className="p-1"
          title={person.has_phone ? "Tem telefone" : "Sem telefone"}
        >
          <Phone size={16} className={person.has_phone ? "text-[#22C55E]" : "text-[#94A3B8]"} />
        </button>
      </div>
    </div>
  );
}

/* ── Tree Node (for department view) ── */
function TreeNode({
  person,
  childrenMap,
  level,
  onAccountAction,
  onPhoneAction,
  isLeader,
}: {
  person: UnifiedPerson;
  childrenMap: Map<string, UnifiedPerson[]>;
  level: number;
  onAccountAction: (p: UnifiedPerson) => void;
  onPhoneAction: (p: UnifiedPerson) => void;
  isLeader: boolean;
}) {
  const children = childrenMap.get(person.id) ?? [];
  const hasChildren = children.length > 0;
  const isLowLevel = person.hierarchy_level === "baixo";
  const [expanded, setExpanded] = useState(!isLowLevel);

  const initials = person.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 hover:bg-accent/40 transition-colors rounded"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0 p-0.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4.5 shrink-0" />
        )}
        <Avatar className="h-8 w-8">
          <AvatarImage src={person.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{person.full_name}</p>
          {person.position && <p className="text-[11px] text-muted-foreground truncate">{person.position}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pr-2">
          <button
            onClick={() => { if (!person.has_account && isLeader) onAccountAction(person); }}
            className="p-0.5"
          >
            <User size={14} className={person.has_account ? "text-[#22C55E]" : "text-[#94A3B8]"} />
          </button>
          <button
            onClick={() => { if (!person.has_phone && isLeader) onPhoneAction(person); }}
            className="p-0.5"
          >
            <Phone size={14} className={person.has_phone ? "text-[#22C55E]" : "text-[#94A3B8]"} />
          </button>
        </div>
      </div>
      {expanded && children.map((child) => (
        <TreeNode
          key={child.id}
          person={child}
          childrenMap={childrenMap}
          level={level + 1}
          onAccountAction={onAccountAction}
          onPhoneAction={onPhoneAction}
          isLeader={isLeader}
        />
      ))}
    </div>
  );
}

/* ── Account Action Modal ── */
function AccountActionModal({
  person,
  people,
  onClose,
  onSuccess,
}: {
  person: UnifiedPerson;
  people: UnifiedPerson[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "link">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saving, setSaving] = useState(false);

  // Profiles not linked to any contact (available for linking)
  const availableProfiles = useMemo(() => {
    return people.filter((p) => p.has_account && !p.contact_id);
  }, [people]);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: {
          full_name: person.full_name,
          email: email.trim(),
          password: password.trim(),
          contact_id: person.contact_id,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Conta criada com sucesso");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta");
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!selectedProfileId || !person.contact_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ linked_profile_id: selectedProfileId })
        .eq("id", person.contact_id);
      if (error) throw error;
      toast.success("Conta vinculada com sucesso");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular conta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" ? "Criar ou vincular conta" : mode === "create" ? "Criar nova conta" : "Vincular conta existente"}
          </DialogTitle>
          <DialogDescription>
            {person.full_name}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="flex flex-col gap-3 py-2">
            <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => setMode("create")}>
              <User size={16} /> Criar nova conta
            </Button>
            <Button variant="outline" className="justify-start gap-2 h-12" onClick={() => setMode("link")} disabled={availableProfiles.length === 0}>
              <User size={16} /> Vincular conta existente
              {availableProfiles.length === 0 && <span className="text-[10px] text-muted-foreground ml-auto">Nenhuma disponível</span>}
            </Button>
          </div>
        )}

        {mode === "create" && (
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={person.full_name} disabled className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm mt-1" placeholder="email@empresa.com" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Senha *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 text-sm mt-1" placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>Voltar</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving || !email.trim() || password.length < 6}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar conta
              </Button>
            </div>
          </div>
        )}

        {mode === "link" && (
          <div className="flex flex-col gap-3 py-2">
            <div>
              <Label className="text-xs">Selecione um perfil</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Escolher perfil..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>Voltar</Button>
              <Button size="sm" onClick={handleLink} disabled={saving || !selectedProfileId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Vincular
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Phone Edit Modal ── */
function PhoneEditModal({
  person,
  onClose,
  onSuccess,
}: {
  person: UnifiedPerson;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSave = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Telefone inválido");
      return;
    }
    setSaving(true);
    try {
      if (person.has_account) {
        // Update profile
        const { error } = await supabase
          .from("profiles")
          .update({ phone: phone.trim() })
          .eq("id", person.id);
        if (error) throw error;
      } else if (person.contact_id) {
        // Update contact
        const { error } = await supabase
          .from("contacts")
          .update({ phone: phone.trim() })
          .eq("id", person.contact_id);
        if (error) throw error;
      }
      toast.success("Telefone atualizado");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar telefone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar telefone</DialogTitle>
          <DialogDescription>{person.full_name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div>
            <Label className="text-xs">Celular</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="h-9 text-sm mt-1"
              placeholder="(99) 99999-9999"
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || phone.replace(/\D/g, "").length < 10}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Org Chart View ── */
function OrgChartView({ onBack }: { onBack: () => void }) {
  const { people, isLoading } = usePeople();
  const { profile } = useAuth();
  const isLeader = profile?.role === "leader";

  const tree = useMemo(() => {
    const nameMap = new Map<string, UnifiedPerson>();
    const idMap = new Map<string, UnifiedPerson>();
    for (const p of people) {
      nameMap.set(p.full_name.toLowerCase().trim(), p);
      idMap.set(p.id, p);
    }

    const childrenMap = new Map<string, UnifiedPerson[]>();
    for (const p of people) {
      let parentId: string | null = null;
      if (p.superior_id && idMap.has(p.superior_id)) parentId = p.superior_id;
      else if (p.superior_name) {
        const superior = nameMap.get(p.superior_name.toLowerCase().trim());
        if (superior) parentId = superior.id;
      }
      const key = parentId ?? "__root__";
      const list = childrenMap.get(key) ?? [];
      list.push(p);
      childrenMap.set(key, list);
    }
    return childrenMap;
  }, [people]);

  const roots = tree.get("__root__") ?? [];

  // Dummy handlers for org chart (no modals here, just visual)
  const noop = () => {};

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground">Organograma</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de hierarquia encontrado</p>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col">
            {roots.map((person) => (
              <TreeNode
                key={person.id}
                person={person}
                childrenMap={tree}
                level={0}
                onAccountAction={noop}
                onPhoneAction={noop}
                isLeader={isLeader}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default PeoplePage;
