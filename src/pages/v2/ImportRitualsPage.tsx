import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, Check, ArrowLeft } from "lucide-react";

/* ─── Types ─── */
type CsvRow = {
  ritual_name: string;
  responsible: string;
  department: string;
  frequency: string;
  occurrence_date: string;
  occurrence_notes: string;
  item_type: string;
  item_title: string;
  item_status: string;
  item_context: string;
};

type PersonMatch = {
  id: string;
  type: "profile" | "contact";
  full_name: string;
};

type RitualPreview = {
  name: string;
  responsible: string;
  responsibleMatch: PersonMatch | null;
  frequency: string;
  occurrenceCount: number;
  itemCount: number;
};

type ParsedData = {
  rituals: RitualPreview[];
  totalOccurrences: number;
  totalItems: number;
  carryForwards: number;
  warnings: string[];
  rows: CsvRow[];
};

/* ─── Helpers ─── */
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .trim()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[🟡🟢🔴⚪🟠⭐⚠️✅❌]+/g, "")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const maxLen = Math.max(wordsA.length, wordsB.length);
  if (maxLen === 0) return true;
  let matching = 0;
  const checkLen = Math.min(wordsA.length, wordsB.length);
  for (let i = 0; i < checkLen; i++) {
    if (wordsA[i] === wordsB[i]) matching++;
  }
  return matching / maxLen >= 0.8;
}

function mapStatus(s: string): string {
  const lower = s.toLowerCase().trim();
  if (lower === "completed" || lower === "concluído" || lower === "concluido") return "completed";
  if (lower === "in_progress" || lower === "em andamento") return "in_progress";
  if (lower === "cancelled" || lower === "cancelado" || lower === "cancelada") return "cancelled";
  return "pending";
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim());
    if (cols.length < 10) continue;
    rows.push({
      ritual_name: cols[0],
      responsible: cols[1],
      department: cols[2],
      frequency: cols[3],
      occurrence_date: cols[4],
      occurrence_notes: cols[5],
      item_type: cols[6],
      item_title: cols[7],
      item_status: cols[8],
      item_context: cols[9],
    });
  }
  return rows;
}

/* ─── Component ─── */
export default function ImportRitualsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "progress" | "done">("upload");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [finalStats, setFinalStats] = useState({ rituals: 0, occurrences: 0, tasks: 0 });

  // People cache
  const [peopleCache, setPeopleCache] = useState<PersonMatch[]>([]);

  const isLeader = profile?.role === "leader";
  if (!isLeader) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Acesso restrito a líderes.</p>
      </div>
    );
  }

  /* ─── Step 1: Parse CSV ─── */
  const handleFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setImportLog(["Nenhuma linha válida encontrada no CSV."]);
      return;
    }

    // Fetch profiles & contacts for matching
    const [{ data: profiles }, { data: contacts }] = await Promise.all([
      supabase.from("profiles").select("id, full_name"),
      supabase.from("contacts").select("id, full_name"),
    ]);

    const people: PersonMatch[] = [
      ...(profiles ?? []).map((p) => ({ id: p.id, type: "profile" as const, full_name: p.full_name ?? "" })),
      ...(contacts ?? []).map((c) => ({ id: c.id, type: "contact" as const, full_name: c.full_name })),
    ];
    setPeopleCache(people);

    const findPerson = (name: string): PersonMatch | null => {
      if (!name.trim()) return null;
      const lower = name.toLowerCase().trim();
      return people.find((p) => p.full_name.toLowerCase().trim() === lower) ?? null;
    };

    // Group by ritual
    const ritualMap = new Map<string, { rows: CsvRow[]; responsible: string; frequency: string }>();
    for (const row of rows) {
      const key = row.ritual_name;
      if (!ritualMap.has(key)) {
        ritualMap.set(key, { rows: [], responsible: row.responsible, frequency: row.frequency });
      }
      ritualMap.get(key)!.rows.push(row);
    }

    const warnings: string[] = [];
    const rituals: RitualPreview[] = [];
    let totalOccurrences = 0;
    let totalItems = 0;
    let carryForwards = 0;

    for (const [name, data] of ritualMap) {
      const match = findPerson(data.responsible);
      if (!match && data.responsible.trim()) {
        warnings.push(`Responsável '${data.responsible}' não encontrado no sistema`);
      }

      const occDates = new Set(data.rows.map((r) => r.occurrence_date));
      const items = data.rows.filter((r) => r.item_type !== "note" && r.item_title.trim());
      totalOccurrences += occDates.size;
      totalItems += items.length;

      // Detect carry-forwards
      const seen = new Set<string>();
      for (const item of items) {
        const norm = normalizeTitle(item.item_title);
        const existing = [...seen].find((s) => fuzzyMatch(s, norm));
        if (existing) {
          carryForwards++;
        } else {
          seen.add(norm);
        }
      }

      rituals.push({
        name,
        responsible: data.responsible,
        responsibleMatch: match,
        frequency: data.frequency,
        occurrenceCount: occDates.size,
        itemCount: items.length,
      });
    }

    setParsed({ rituals, totalOccurrences, totalItems, carryForwards, warnings, rows });
    setStep("preview");
  };

  /* ─── Step 3: Import ─── */
  const doImport = async () => {
    if (!parsed || !user) return;
    setStep("progress");
    setProgressPct(0);

    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(msg);
      setImportLog([...log]);
    };

    try {
      // Group rows by ritual
      const ritualMap = new Map<string, CsvRow[]>();
      for (const row of parsed.rows) {
        const arr = ritualMap.get(row.ritual_name) ?? [];
        arr.push(row);
        ritualMap.set(row.ritual_name, arr);
      }

      const ritualEntries = [...ritualMap.entries()];
      let createdRituals = 0;
      let createdOccurrences = 0;
      let createdTasks = 0;

      // PHASE 1: Create rituals
      setProgressText("Criando ritualísticas...");
      const ritualIdMap = new Map<string, string>();

      for (let i = 0; i < ritualEntries.length; i += 10) {
        const batch = ritualEntries.slice(i, i + 10);
        for (const [name, rows] of batch) {
          try {
            const freq = rows[0].frequency || "monthly";
            const { data, error } = await supabase
              .from("rituals")
              .insert({ name, frequency: freq, created_by: user.id })
              .select("id")
              .single();
            if (error) {
              addLog(`⚠️ Erro ao criar '${name}': ${error.message}`);
              continue;
            }
            ritualIdMap.set(name, data.id);
            createdRituals++;

            // Add responsible as member
            const responsible = rows[0].responsible;
            if (responsible.trim()) {
              const match = peopleCache.find(
                (p) => p.full_name.toLowerCase().trim() === responsible.toLowerCase().trim()
              );
              if (match?.type === "profile") {
                await supabase.from("ritual_members").insert({
                  ritual_id: data.id,
                  profile_id: match.id,
                });
              }
            }
          } catch (e: any) {
            addLog(`⚠️ Erro ao criar '${name}': ${e.message}`);
          }
        }
        setProgressPct(Math.round(((i + batch.length) / ritualEntries.length) * 30));
        setProgressText(`Criando ritualísticas... ${Math.min(i + 10, ritualEntries.length)}/${ritualEntries.length}`);
      }

      // PHASE 2: Create occurrences per ritual
      setProgressText("Criando ocorrências...");
      type OccInfo = { id: string; date: string; notes: string };
      const occMap = new Map<string, OccInfo[]>(); // ritual_name -> occurrences sorted by date
      let totalOccs = 0;

      for (const [name, rows] of ritualEntries) {
        const ritualId = ritualIdMap.get(name);
        if (!ritualId) continue;

        const dateGroups = new Map<string, string>();
        for (const row of rows) {
          if (!dateGroups.has(row.occurrence_date)) {
            dateGroups.set(row.occurrence_date, row.occurrence_notes);
          }
        }
        totalOccs += dateGroups.size;
      }

      let occsDone = 0;
      for (const [name, rows] of ritualEntries) {
        const ritualId = ritualIdMap.get(name);
        if (!ritualId) continue;

        const dateGroups = new Map<string, string>();
        for (const row of rows) {
          if (!dateGroups.has(row.occurrence_date)) {
            dateGroups.set(row.occurrence_date, row.occurrence_notes);
          }
        }

        const sortedDates = [...dateGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const occs: OccInfo[] = [];

        for (let i = 0; i < sortedDates.length; i += 10) {
          const batch = sortedDates.slice(i, i + 10);
          for (const [dateStr, notes] of batch) {
            try {
              const parsedDate = parseDate(dateStr);
              const { data, error } = await supabase
                .from("ritual_occurrences")
                .insert({
                  ritual_id: ritualId,
                  date: parsedDate,
                  status: "closed",
                  notes: notes || null,
                  created_by: user.id,
                })
                .select("id")
                .single();
              if (error) {
                addLog(`⚠️ Erro ocorrência '${name}' ${dateStr}: ${error.message}`);
                continue;
              }
              occs.push({ id: data.id, date: dateStr, notes });
              createdOccurrences++;
              occsDone++;
            } catch (e: any) {
              addLog(`⚠️ Erro ocorrência '${name}' ${dateStr}: ${e.message}`);
              occsDone++;
            }
          }
          setProgressPct(30 + Math.round((occsDone / totalOccs) * 30));
          setProgressText(`Criando ocorrências... ${occsDone}/${totalOccs}`);
        }

        occMap.set(name, occs);
      }

      // PHASE 3: Create cards with carry-forward
      setProgressText("Criando tarefas...");
      const totalItems = parsed.totalItems;
      let itemsDone = 0;

      for (const [name, rows] of ritualEntries) {
        const ritualId = ritualIdMap.get(name);
        if (!ritualId) continue;
        const occs = occMap.get(name) ?? [];
        if (!occs.length) continue;

        // Sort rows chronologically
        const itemRows = rows
          .filter((r) => r.item_type !== "note" && r.item_title.trim())
          .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));

        // carry-forward map: normalizedTitle → { cardId, lastStatus, lastContext, lastOccId }
        const cfMap = new Map<string, { cardId: string; lastStatus: string; lastContext: string; lastOccId: string }>();

        // Find person for assigning
        const responsible = rows[0].responsible;
        const personMatch = responsible.trim()
          ? peopleCache.find((p) => p.full_name.toLowerCase().trim() === responsible.toLowerCase().trim())
          : null;

        for (const item of itemRows) {
          const occInfo = occs.find((o) => o.date === item.occurrence_date);
          if (!occInfo) { itemsDone++; continue; }

          const norm = normalizeTitle(item.item_title);
          // Check if fuzzy-matches an existing key
          let matchedKey: string | null = null;
          for (const key of cfMap.keys()) {
            if (fuzzyMatch(key, norm)) {
              matchedKey = key;
              break;
            }
          }

          const status = mapStatus(item.item_status);

          try {
            if (matchedKey) {
              // CARRY-FORWARD: update existing card
              const prev = cfMap.get(matchedKey)!;

              // Create history for the previous state
              await supabase.from("task_history").insert({
                card_id: prev.cardId,
                ritual_occurrence_id: prev.lastOccId,
                status_at_time: prev.lastStatus,
                context_note: prev.lastContext || null,
                updated_by: user.id,
              });

              // Update card to point to current occurrence
              await supabase
                .from("cards")
                .update({ status, ritual_occurrence_id: occInfo.id })
                .eq("id", prev.cardId);

              // Update carry-forward map
              cfMap.set(matchedKey, {
                cardId: prev.cardId,
                lastStatus: status,
                lastContext: item.item_context || "",
                lastOccId: occInfo.id,
              });
            } else {
              // NEW card
              const { data: card, error } = await supabase
                .from("cards")
                .insert({
                  title: item.item_title.trim(),
                  card_type: "task",
                  status,
                  start_date: parseDate(item.occurrence_date),
                  created_by: user.id,
                  origin_type: "ritual",
                  ritual_occurrence_id: occInfo.id,
                })
                .select("id")
                .single();

              if (error) {
                addLog(`⚠️ Erro tarefa '${item.item_title}': ${error.message}`);
                itemsDone++;
                continue;
              }

              createdTasks++;

              // Assign responsible
              if (personMatch?.type === "profile") {
                await supabase.from("card_assignees").insert({ card_id: card.id, profile_id: personMatch.id });
              } else if (personMatch?.type === "contact") {
                await supabase.from("card_contact_assignees").insert({ card_id: card.id, contact_id: personMatch.id });
              }

              // Create initial history if context exists
              if (item.item_context?.trim()) {
                await supabase.from("task_history").insert({
                  card_id: card.id,
                  ritual_occurrence_id: occInfo.id,
                  status_at_time: status,
                  context_note: item.item_context.trim(),
                  updated_by: user.id,
                });
              }

              cfMap.set(norm, {
                cardId: card.id,
                lastStatus: status,
                lastContext: item.item_context || "",
                lastOccId: occInfo.id,
              });
            }
          } catch (e: any) {
            addLog(`⚠️ Erro tarefa '${item.item_title}': ${e.message}`);
          }

          itemsDone++;
          if (itemsDone % 10 === 0 || itemsDone === totalItems) {
            setProgressPct(60 + Math.round((itemsDone / Math.max(totalItems, 1)) * 40));
            setProgressText(`Criando tarefas... ${itemsDone}/${totalItems}`);
          }
        }
      }

      setFinalStats({ rituals: createdRituals, occurrences: createdOccurrences, tasks: createdTasks });
      setStep("done");
      setProgressPct(100);
    } catch (e: any) {
      addLog(`❌ Erro fatal: ${e.message}`);
      setStep("done");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-4 py-3 sticky top-0 bg-background z-10 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Importar Ritualísticas Históricas</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Upload do CSV</h2>
                <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
                  Formato esperado (delimitador <code>;</code>):
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted rounded px-2 py-1 inline-block">
                  ritual_name;responsible;department;frequency;occurrence_date;occurrence_notes;item_type;item_title;item_status;item_context
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button onClick={() => fileRef.current?.click()} className="gap-2">
                <FileText size={16} /> Selecionar arquivo CSV
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && parsed && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                {parsed.rituals.length} ritualísticas · {parsed.totalOccurrences} ocorrências · {parsed.totalItems} tarefas · {parsed.carryForwards} carry-forwards
              </p>
            </div>

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  <AlertTriangle size={14} /> Avisos ({parsed.warnings.length})
                </p>
                {parsed.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300">• {w}</p>
                ))}
              </div>
            )}

            {/* Ritual list */}
            <div className="space-y-2">
              {parsed.rituals.map((r) => (
                <div key={r.name} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.responsible}
                        {r.responsibleMatch ? (
                          <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">match</Badge>
                        ) : r.responsible.trim() ? (
                          <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">não encontrado</Badge>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <p>{r.occurrenceCount} ocorrências</p>
                      <p>{r.itemCount} itens</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("upload"); setParsed(null); }}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={doImport}>
                Importar tudo
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Progress */}
        {(step === "progress" || step === "done") && (
          <div className="space-y-4">
            <Progress value={progressPct} className="h-2" />
            <p className="text-sm font-medium text-foreground text-center">{progressText}</p>

            {step === "done" && (
              <div className="text-center space-y-3 pt-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check size={24} className="text-green-600" />
                </div>
                <p className="text-sm font-semibold text-foreground">Importação concluída!</p>
                <p className="text-xs text-muted-foreground">
                  {finalStats.rituals} ritualísticas, {finalStats.occurrences} ocorrências, {finalStats.tasks} tarefas
                </p>
                <Button onClick={() => navigate("/app/rituals")} className="mt-2">
                  Ver Ritualísticas
                </Button>
              </div>
            )}

            {/* Log */}
            {importLog.length > 0 && (
              <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-foreground mb-1">Log</p>
                {importLog.map((msg, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">{msg}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Date parser ─── */
function parseDate(dateStr: string): string {
  // Try common formats: dd/mm/yyyy, yyyy-mm-dd, mm/dd/yyyy
  const trimmed = dateStr.trim();
  
  // dd/mm/yyyy
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).toISOString();
  }
  
  // yyyy-mm-dd
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])).toISOString();
  }

  // Fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString();
  
  return new Date().toISOString();
}
