import { useState } from "react";
import { format, isSameDay, addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Inbox, Filter, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFeedCards, type FeedStatusFilter, type EnrichedFeedCard } from "@/hooks/useFeedCards";
import { useAssigneeOptions, type AssigneeOption } from "@/hooks/useAssigneeOptions";
import FeedCard from "@/components/feed/FeedCard";
import QuickCreateBar from "@/components/feed/QuickCreateBar";

const FILTERS: { key: FeedStatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "overdue", label: "Atrasados" },
  { key: "in_progress", label: "Em andamento" },
  { key: "completed", label: "Concluídos" },
];

type DateGroup = { key: string; label: string; cards: EnrichedFeedCard[] };

function groupByDate(cards: EnrichedFeedCard[]): DateGroup[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const groups: Record<string, EnrichedFeedCard[]> = { today: [], tomorrow: [], week: [], later: [] };

  for (const card of cards) {
    const d = startOfDay(new Date(card.start_date));
    if (isSameDay(d, today)) groups.today.push(card);
    else if (isSameDay(d, tomorrow)) groups.tomorrow.push(card);
    else if (isAfter(d, tomorrow) && isBefore(d, weekEnd)) groups.week.push(card);
    else groups.later.push(card);
  }

  const result: DateGroup[] = [];
  if (groups.today.length > 0) result.push({ key: "today", label: `Hoje — ${format(today, "EEE, d MMM", { locale: ptBR })}`, cards: groups.today });
  if (groups.tomorrow.length > 0) result.push({ key: "tomorrow", label: `Amanhã — ${format(tomorrow, "EEE, d MMM", { locale: ptBR })}`, cards: groups.tomorrow });
  if (groups.week.length > 0) result.push({ key: "week", label: "Próxima semana", cards: groups.week });
  if (groups.later.length > 0) result.push({ key: "later", label: "Mais tarde", cards: groups.later });
  return result;
}

function FeedSkeleton() {
  return (
    <div className="space-y-5 px-4 pt-4">
      {[1, 2, 3].map((g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          {[1, 2].map((c) => (
            <Skeleton key={c} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}

type PersonFilter = { id: string; type: "profile" | "contact"; name: string } | null;

export default function FeedPage() {
  const [statusFilter, setStatusFilter] = useState<FeedStatusFilter>("all");
  const [personFilter, setPersonFilter] = useState<PersonFilter>(null);
  const [personSearchOpen, setPersonSearchOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState("");

  const { options: assigneeOptions } = useAssigneeOptions();
  const { cards, isLoading, overdueCount, refetch, createQuickTask } = useFeedCards(
    statusFilter,
    personFilter ? { id: personFilter.id, type: personFilter.type } : null
  );
  const groups = groupByDate(cards);

  const filteredPeople = assigneeOptions.filter((o) =>
    o.full_name.toLowerCase().includes(personSearch.toLowerCase())
  );

  const selectPerson = (o: AssigneeOption) => {
    setPersonFilter({ id: o.id, type: o.type, name: o.full_name });
    setPersonSearchOpen(false);
    setPersonSearch("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Filter chips */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                }`}
              >
                {f.label}
                {f.key === "overdue" && overdueCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] px-1">
                    {overdueCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Person filter */}
          {personFilter ? (
            <button
              onClick={() => setPersonFilter(null)}
              className="shrink-0 h-8 px-3 rounded-full text-xs font-medium bg-primary/10 text-primary flex items-center gap-1.5"
            >
              {personFilter.name}
              <X size={12} />
            </button>
          ) : (
            <Popover open={personSearchOpen} onOpenChange={setPersonSearchOpen}>
              <PopoverTrigger asChild>
                <button className="shrink-0 h-8 px-3 rounded-full text-xs font-medium bg-accent text-muted-foreground flex items-center gap-1.5">
                  <Filter size={12} />
                  Pessoa
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-0" align="start">
                <div className="p-2 border-b border-border">
                  <Input
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    placeholder="Buscar pessoa..."
                    className="h-7 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {filteredPeople.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
                  )}
                  {filteredPeople.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => selectPerson(o)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-accent transition-colors"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback
                          className={`text-[9px] ${o.type === "contact" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}
                        >
                          {o.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{o.full_name}</span>
                      {o.type === "contact" && (
                        <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">sem conta</span>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <button
            onClick={() => refetch()}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-accent text-muted-foreground"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {isLoading ? (
          <FeedSkeleton />
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <Inbox size={48} strokeWidth={1.2} />
            <p className="text-sm">Nenhuma tarefa para exibir</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.cards.map((card) => (
                  <FeedCard key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <QuickCreateBar createQuickTask={createQuickTask} />
    </div>
  );
}
