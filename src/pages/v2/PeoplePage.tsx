import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Network, Upload, Download, ChevronRight,
  ArrowLeft, User, Phone, Loader2, Users, Building2, Layers,
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
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { usePeople, type UnifiedPerson } from "@/hooks/usePeople";
import { useOrgImport } from "@/hooks/useOrgImport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef } from "react";

/* ── Nav Stack Types ── */
type NavItem =
  | { type: "list" }
  | { type: "departments" }
  | { type: "dept"; name: string }
  | { type: "person"; id: string };

/* ── Helpers ── */
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function deptColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

function findSubordinates(person: UnifiedPerson, people: UnifiedPerson[]): UnifiedPerson[] {
  return people.filter((p) => {
    if (p.id === person.id) return false;
    if (p.superior_id === person.id) return true;
    if (p.superior_name && person.full_name && p.superior_name.toLowerCase().trim() === person.full_name.toLowerCase().trim()) return true;
    return false;
  });
}

function findDeptLeader(deptPeople: UnifiedPerson[]): UnifiedPerson | null {
  const high = deptPeople.find((p) => p.hierarchy_level === "alto");
  if (high) return high;
  const noSuperiorInDept = deptPeople.find((p) => {
    if (!p.superior_id && !p.superior_name) return true;
    const superiorInDept = deptPeople.find((s) =>
      s.id !== p.id && (s.id === p.superior_id || (p.superior_name && s.full_name.toLowerCase().trim() === p.superior_name.toLowerCase().trim()))
    );
    return !superiorInDept;
  });
  return noSuperiorInDept ?? deptPeople[0] ?? null;
}

/* ── Main Page ── */
const PeoplePage = () => {
  const [navStack, setNavStack] = useState<NavItem[]>([{ type: "list" }]);
  const { profile } = useAuth();
  const isLeader = profile?.role === "leader";
  const { people, departments, stats, isLoading, refetch } = usePeople();

  // Modal states elevated here for all views
  const [accountModal, setAccountModal] = useState<UnifiedPerson | null>(null);
  const [phoneModal, setPhoneModal] = useState<UnifiedPerson | null>(null);

  const current = navStack[navStack.length - 1];
  const pushNav = useCallback((item: NavItem) => setNavStack((prev) => [...prev, item]), []);
  const popNav = useCallback(() => setNavStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev), []);

  const sharedProps = { people, isLeader, pushNav, popNav, onAccountAction: setAccountModal, onPhoneAction: setPhoneModal };

  let content: React.ReactNode;
  switch (current.type) {
    case "list":
      content = (
        <ListView
          onOrgChart={() => setNavStack([{ type: "departments" }])}
          isLeader={isLeader}
          people={people}
          departments={departments}
          stats={stats}
          isLoading={isLoading}
          refetch={refetch}
          onAccountAction={setAccountModal}
          onPhoneAction={setPhoneModal}
        />
      );
      break;
    case "departments":
      content = <DepartmentsView {...sharedProps} departments={departments} isLoading={isLoading} />;
      break;
    case "dept":
      content = <DepartmentDetailView {...sharedProps} deptName={current.name} navStack={navStack} />;
      break;
    case "person":
      content = <PersonDetailView {...sharedProps} personId={current.id} navStack={navStack} />;
      break;
  }

  return (
    <div className="flex flex-col h-full">
      {content}

      {accountModal && (
        <AccountActionModal
          person={accountModal}
          people={people}
          onClose={() => setAccountModal(null)}
          onSuccess={refetch}
        />
      )}
      {phoneModal && (
        <PhoneEditModal
          person={phoneModal}
          onClose={() => setPhoneModal(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

/* ── List View ── */
function ListView({
  onOrgChart, isLeader, people, departments, stats, isLoading, refetch, onAccountAction, onPhoneAction,
}: {
  onOrgChart: () => void; isLeader: boolean; people: UnifiedPerson[]; departments: string[];
  stats: { withAccount: number; withoutAccount: number; withoutPhone: number };
  isLoading: boolean; refetch: () => void;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
}) {
  const navigate = useNavigate();
  const { importCsv, downloadTemplate, isImporting, result } = useOrgImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = people;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.full_name.toLowerCase().includes(q));
    }
    if (deptFilter) list = list.filter((p) => p.department === deptFilter);
    return list;
  }, [people, search, deptFilter]);

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

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

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pessoa encontrada</p>
          ) : (
            filtered.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onClick={() => person.has_account ? navigate(`/app/feed?person=${person.id}`) : undefined}
                onAccountAction={onAccountAction}
                onPhoneAction={onPhoneAction}
                isLeader={isLeader}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Person Card (reusable) ── */
function PersonCard({
  person, onClick, onAccountAction, onPhoneAction, isLeader, showDept, showChevron, badge,
}: {
  person: UnifiedPerson; onClick?: () => void;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
  isLeader: boolean; showDept?: boolean; showChevron?: boolean; badge?: string;
}) {
  const initials = getInitials(person.full_name);

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/60 transition-colors">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={person.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{person.full_name}</p>
            {badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">{badge}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {person.position || ""}
            {person.position && (showDept ? person.department : "") ? " · " : ""}
            {showDept ? (person.department || "") : ""}
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
        {!showChevron && (
          <>
            <button onClick={(e) => { e.stopPropagation(); if (!person.has_account && isLeader) onAccountAction(person); }} className="p-1" title={person.has_account ? "Tem conta" : "Sem conta"}>
              <User size={16} className={person.has_account ? "text-[#22C55E]" : "text-[#94A3B8]"} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (!person.has_phone && isLeader) onPhoneAction(person); }} className="p-1" title={person.has_phone ? "Tem telefone" : "Sem telefone"}>
              <Phone size={16} className={person.has_phone ? "text-[#22C55E]" : "text-[#94A3B8]"} />
            </button>
          </>
        )}
        {showChevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

/* ── Status Icons (small inline) ── */
function StatusIcons({ person, isLeader, onAccountAction, onPhoneAction }: {
  person: UnifiedPerson; isLeader: boolean;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => { if (!person.has_account && isLeader) onAccountAction(person); }} className="p-0.5">
        <User size={14} className={person.has_account ? "text-[#22C55E]" : "text-[#94A3B8]"} />
      </button>
      <button onClick={() => { if (!person.has_phone && isLeader) onPhoneAction(person); }} className="p-0.5">
        <Phone size={14} className={person.has_phone ? "text-[#22C55E]" : "text-[#94A3B8]"} />
      </button>
    </div>
  );
}

/* ── Nav Breadcrumb ── */
function NavBreadcrumb({ navStack, people }: { navStack: NavItem[]; people: UnifiedPerson[] }) {
  if (navStack.length <= 1) return null;
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        {navStack.map((item, idx) => {
          const isLast = idx === navStack.length - 1;
          let label = "";
          switch (item.type) {
            case "list": label = "Pessoas"; break;
            case "departments": label = "HOT SAT"; break;
            case "dept": label = item.name; break;
            case "person": {
              const p = people.find((pp) => pp.id === item.id);
              label = p?.full_name ?? "Pessoa";
              break;
            }
          }
          return (
            <BreadcrumbItem key={idx}>
              {isLast ? <BreadcrumbPage>{label}</BreadcrumbPage> : <BreadcrumbLink className="text-xs">{label}</BreadcrumbLink>}
              {!isLast && <BreadcrumbSeparator />}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/* ── Departments View ── */
function DepartmentsView({
  people, departments, isLoading, pushNav, popNav, isLeader, onAccountAction, onPhoneAction,
}: {
  people: UnifiedPerson[]; departments: string[]; isLoading: boolean;
  pushNav: (item: NavItem) => void; popNav: () => void; isLeader: boolean;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
}) {
  const [search, setSearch] = useState("");

  const hierarchyLevels = useMemo(() => {
    const levels = new Set(people.map((p) => p.hierarchy_level).filter(Boolean));
    return levels.size;
  }, [people]);

  const deptData = useMemo(() => {
    return departments.map((d) => {
      const deptPeople = people.filter((p) => p.department === d);
      const leader = findDeptLeader(deptPeople);
      return { name: d, count: deptPeople.length, leader };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [people, departments]);

  const searchResults = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return people.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [people, search]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={popNav}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground">Organograma HOT SAT</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border p-3 text-center">
          <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-semibold text-foreground">{people.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <Building2 className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-semibold text-foreground">{departments.length}</p>
          <p className="text-[10px] text-muted-foreground">Departamentos</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <Layers className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-semibold text-foreground">{hierarchyLevels}</p>
          <p className="text-[10px] text-muted-foreground">Níveis</p>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : searchResults ? (
          <div className="flex flex-col gap-1">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma pessoa encontrada</p>
            ) : (
              searchResults.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  onClick={() => pushNav({ type: "person", id: p.id })}
                  onAccountAction={onAccountAction}
                  onPhoneAction={onPhoneAction}
                  isLeader={isLeader}
                  showDept
                  showChevron
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {deptData.map((dept) => {
              const deptInitials = dept.name.slice(0, 2).toUpperCase();
              return (
                <button
                  key={dept.name}
                  onClick={() => pushNav({ type: "dept", name: dept.name })}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent/60 transition-colors w-full"
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{ backgroundColor: deptColor(dept.name) }}
                  >
                    {deptInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{dept.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {dept.leader?.full_name ?? "Sem líder"} · {dept.count} pessoa{dept.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
            {deptData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum departamento encontrado</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Department Detail View ── */
function DepartmentDetailView({
  people, deptName, navStack, pushNav, popNav, isLeader, onAccountAction, onPhoneAction,
}: {
  people: UnifiedPerson[]; deptName: string; navStack: NavItem[];
  pushNav: (item: NavItem) => void; popNav: () => void; isLeader: boolean;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
}) {
  const deptPeople = useMemo(() => people.filter((p) => p.department === deptName), [people, deptName]);
  const leader = useMemo(() => findDeptLeader(deptPeople), [deptPeople]);

  const levelCounts = useMemo(() => {
    const counts = { alto: 0, medio: 0, baixo: 0 };
    for (const p of deptPeople) {
      if (p.hierarchy_level === "alto") counts.alto++;
      else if (p.hierarchy_level === "medio" || p.hierarchy_level === "médio") counts.medio++;
      else if (p.hierarchy_level === "baixo") counts.baixo++;
    }
    return counts;
  }, [deptPeople]);

  const { reportsToLeader, others } = useMemo(() => {
    if (!leader) return { reportsToLeader: [] as UnifiedPerson[], others: deptPeople };
    const reports = findSubordinates(leader, deptPeople);
    const reportIds = new Set([leader.id, ...reports.map((r) => r.id)]);
    const rest = deptPeople.filter((p) => !reportIds.has(p.id));
    return { reportsToLeader: reports, others: rest };
  }, [deptPeople, leader]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={popNav}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground truncate">{deptName}</h2>
      </div>

      <NavBreadcrumb navStack={navStack} people={people} />

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3">
          {/* Leader card */}
          {leader && (
            <button
              onClick={() => pushNav({ type: "person", id: leader.id })}
              className="flex items-center gap-3 rounded-r-xl py-3 px-3 text-left transition-colors hover:bg-primary/10 bg-primary/5 border-l-[3px] border-primary w-full"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={leader.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(leader.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-medium text-foreground truncate">{leader.full_name}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">líder</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{leader.position || "Sem cargo"}</p>
              </div>
              <StatusIcons person={leader} isLeader={isLeader} onAccountAction={onAccountAction} onPhoneAction={onPhoneAction} />
            </button>
          )}

          {/* Counters */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Total", value: deptPeople.length },
              { label: "Alto", value: levelCounts.alto },
              { label: "Médio", value: levelCounts.medio },
              { label: "Baixo", value: levelCounts.baixo },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border p-2 text-center">
                <p className="text-base font-semibold text-foreground">{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Reports to leader */}
          {reportsToLeader.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                Reportam a {leader?.full_name ?? "líder"} ({reportsToLeader.length})
              </p>
              <div className="flex flex-col gap-0.5">
                {reportsToLeader.map((p) => {
                  const subs = findSubordinates(p, people);
                  const hasSubs = subs.length > 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors">
                      <button onClick={() => pushNav({ type: "person", id: p.id })} className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{p.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.position || ""}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasSubs ? (
                          <>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{subs.length} pessoa{subs.length !== 1 ? "s" : ""}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </>
                        ) : (
                          <StatusIcons person={p} isLeader={isLeader} onAccountAction={onAccountAction} onPhoneAction={onPhoneAction} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Others */}
          {others.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                Outros no departamento ({others.length})
              </p>
              <div className="flex flex-col gap-0.5">
                {others.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors">
                    <button onClick={() => pushNav({ type: "person", id: p.id })} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{p.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.position || ""}</p>
                      </div>
                    </button>
                    <StatusIcons person={p} isLeader={isLeader} onAccountAction={onAccountAction} onPhoneAction={onPhoneAction} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Person Detail View ── */
function PersonDetailView({
  people, personId, navStack, pushNav, popNav, isLeader, onAccountAction, onPhoneAction,
}: {
  people: UnifiedPerson[]; personId: string; navStack: NavItem[];
  pushNav: (item: NavItem) => void; popNav: () => void; isLeader: boolean;
  onAccountAction: (p: UnifiedPerson) => void; onPhoneAction: (p: UnifiedPerson) => void;
}) {
  const navigate = useNavigate();
  const person = people.find((p) => p.id === personId);
  if (!person) return <p className="text-sm text-muted-foreground text-center py-8">Pessoa não encontrada</p>;

  const superior = person.superior_id ? people.find((p) => p.id === person.superior_id) : null;
  const subordinates = findSubordinates(person, people);

  const levelLabel: Record<string, string> = { alto: "Alto", medio: "Médio", médio: "Médio", baixo: "Baixo" };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={popNav}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground truncate">{person.full_name}</h2>
      </div>

      <NavBreadcrumb navStack={navStack} people={people} />

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4">
          {/* Profile card */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={person.avatar_url ?? undefined} />
                <AvatarFallback className="text-sm bg-primary/10 text-primary">{getInitials(person.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-foreground">{person.full_name}</p>
                <p className="text-[13px] text-muted-foreground">{person.position || "Sem cargo"}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {person.department && (
                    <Badge variant="secondary" className="text-[10px]">{person.department}</Badge>
                  )}
                  {person.hierarchy_level && (
                    <Badge variant="secondary" className="text-[10px]">{levelLabel[person.hierarchy_level] ?? person.hierarchy_level}</Badge>
                  )}
                  <Badge variant={person.has_account ? "default" : "secondary"} className={`text-[10px] ${person.has_account ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}`}>
                    {person.has_account ? "Conta ativa" : "Sem conta"}
                  </Badge>
                </div>
                {person.phone && <p className="text-xs text-muted-foreground mt-2">📱 {person.phone}</p>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              onClick={() => navigate(`/app/feed?person=${person.id}`)}
            >
              Ver tarefas
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => toast.info("Em breve")}
            >
              Atribuir tarefa
            </Button>
          </div>

          {/* Reports to */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 px-1">Reporta a</p>
            {superior ? (
              <button
                onClick={() => pushNav({ type: "person", id: superior.id })}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors w-full text-left"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={superior.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(superior.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{superior.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{superior.position || ""}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : (
              <p className="text-sm text-muted-foreground px-3 py-2">Sem superior identificado</p>
            )}
          </div>

          {/* Subordinates */}
          {subordinates.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 px-1">
                Subordinados diretos ({subordinates.length})
              </p>
              <div className="flex flex-col gap-0.5">
                {subordinates.map((sub) => {
                  const subSubs = findSubordinates(sub, people);
                  const hasSubs = subSubs.length > 0;
                  return (
                    <div key={sub.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 transition-colors">
                      <button onClick={() => pushNav({ type: "person", id: sub.id })} className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={sub.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(sub.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{sub.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{sub.position || ""}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasSubs ? (
                          <>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{subSubs.length}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </>
                        ) : (
                          <StatusIcons person={sub} isLeader={isLeader} onAccountAction={onAccountAction} onPhoneAction={onPhoneAction} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account/Phone actions for this person */}
          {isLeader && (!person.has_account || !person.has_phone) && (
            <div className="flex gap-2 px-1">
              {!person.has_account && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onAccountAction(person)}>
                  <User size={14} /> Criar conta
                </Button>
              )}
              {!person.has_phone && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onPhoneAction(person)}>
                  <Phone size={14} /> Adicionar telefone
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
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
          <DialogDescription>{person.full_name}</DialogDescription>
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
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.full_name}</SelectItem>
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
  person, onClose, onSuccess,
}: {
  person: UnifiedPerson; onClose: () => void; onSuccess: () => void;
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
    if (digits.length < 10) { toast.error("Telefone inválido"); return; }
    setSaving(true);
    try {
      if (person.has_account) {
        const { error } = await supabase.from("profiles").update({ phone: phone.trim() }).eq("id", person.id);
        if (error) throw error;
      } else if (person.contact_id) {
        const { error } = await supabase.from("contacts").update({ phone: phone.trim() }).eq("id", person.contact_id);
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
            <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="h-9 text-sm mt-1" placeholder="(99) 99999-9999" autoFocus />
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

export default PeoplePage;
