import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Network,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  User,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { usePeople, type PersonWithStats } from "@/hooks/usePeople";
import { useOrgImport } from "@/hooks/useOrgImport";
import { useRef } from "react";

type View = "list" | "orgchart";

const PeoplePage = () => {
  const [view, setView] = useState<View>("list");
  const { profile } = useAuth();
  const isLeader = profile?.role === "leader";

  if (view === "orgchart") {
    return <OrgChartView onBack={() => setView("list")} />;
  }

  return <ListView onOrgChart={() => setView("orgchart")} isLeader={isLeader} />;
};

/* ── List View ── */
function ListView({
  onOrgChart,
  isLeader,
}: {
  onOrgChart: () => void;
  isLeader: boolean;
}) {
  const navigate = useNavigate();
  const { profiles, contacts, departments, isLoading, refetch } = usePeople();
  const { importCsv, downloadTemplate, isImporting, result } = useOrgImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const lastImport = localStorage.getItem("semear_last_org_import");

  const filtered = useMemo(() => {
    let list = profiles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.full_name?.toLowerCase().includes(q));
    }
    if (deptFilter) {
      list = list.filter((p) => p.department === deptFilter);
    }
    return list;
  }, [profiles, search, deptFilter]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCsv(file);
    if (fileRef.current) fileRef.current.value = "";
    refetch();
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOrgChart} className="gap-1.5">
          <Network className="h-4 w-4" />
          Organograma
        </Button>
        {isLeader && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={isImporting}
              className="gap-1.5"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-1.5">
              <Download className="h-4 w-4" />
              Modelo
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>

      {lastImport && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          Última atualização:{" "}
          {new Date(lastImport).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-border p-3 text-xs space-y-1">
          <span className="text-green-600 font-medium">{result.imported} importado(s)</span>
          {" · "}
          <span className="text-blue-600 font-medium">{result.updated} atualizado(s)</span>
          {result.errors.length > 0 && (
            <p className="text-destructive">{result.errors.length} erro(s)</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Department chips */}
      {departments.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => setDeptFilter(null)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              !deptFilter
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground"
            }`}
          >
            Todos
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDeptFilter(deptFilter === d ? null : d)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                deptFilter === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* People list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma pessoa encontrada
            </p>
          ) : (
            filtered.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onClick={() => navigate(`/app/feed?person=${person.id}`)}
              />
            ))
          )}
        </div>

        {/* Contacts without account */}
        {contacts.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Contatos sem conta
            </p>
            <div className="flex flex-col gap-1">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg bg-accent/40 px-3 py-2.5"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.phone}
                      {c.department && ` · ${c.department}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    Sem conta
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Person Card ── */
function PersonCard({
  person,
  onClick,
}: {
  person: PersonWithStats;
  onClick: () => void;
}) {
  const initials = (person.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/60 transition-colors"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={person.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {person.full_name || "Sem nome"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {person.position || ""}
          {person.position && person.department ? " · " : ""}
          {person.department || ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {person.pending_count > 0 && (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5">
            {person.pending_count}
          </Badge>
        )}
        {person.overdue_count > 0 && (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5">
            {person.overdue_count}
          </Badge>
        )}
      </div>
    </button>
  );
}

/* ── Org Chart View ── */
function OrgChartView({ onBack }: { onBack: () => void }) {
  const { profiles, isLoading } = usePeople();

  // Build tree from superior_id
  const tree = useMemo(() => {
    const childrenMap = new Map<string | null, PersonWithStats[]>();
    for (const p of profiles) {
      const key = p.superior_id ?? null;
      const list = childrenMap.get(key) ?? [];
      list.push(p);
      childrenMap.set(key, list);
    }
    return childrenMap;
  }, [profiles]);

  // Root nodes = no superior or superior not in list
  const profileIds = new Set(profiles.map((p) => p.id));
  const roots = profiles.filter(
    (p) => !p.superior_id || !profileIds.has(p.superior_id)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-foreground">Organograma</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nenhum dado de hierarquia encontrado
        </p>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col">
            {roots.map((person) => (
              <OrgNode key={person.id} person={person} childrenMap={tree} level={0} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function OrgNode({
  person,
  childrenMap,
  level,
}: {
  person: PersonWithStats;
  childrenMap: Map<string | null, PersonWithStats[]>;
  level: number;
}) {
  const children = childrenMap.get(person.id) ?? [];
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(level < 2);

  const initials = (person.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left py-2 hover:bg-accent/40 transition-colors rounded"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Avatar className="h-7 w-7">
          <AvatarImage src={person.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {person.full_name || "Sem nome"}
          </p>
          {person.position && (
            <p className="text-[11px] text-muted-foreground truncate">{person.position}</p>
          )}
        </div>
      </button>
      {expanded &&
        children.map((child) => (
          <OrgNode key={child.id} person={child} childrenMap={childrenMap} level={level + 1} />
        ))}
    </div>
  );
}

export default PeoplePage;
