import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImportResult {
  imported: number;
  updated: number;
  errors: string[];
}

interface CsvRow {
  nome: string;
  cargo: string;
  departamento: string;
  superior: string;
  celular: string;
  grau: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const colMap = {
    nome: headers.findIndex((h) => h.includes("nome")),
    cargo: headers.findIndex((h) => h.includes("cargo")),
    departamento: headers.findIndex((h) => h.includes("departamento")),
    superior: headers.findIndex((h) => h.includes("superior")),
    celular: headers.findIndex((h) => h.includes("celular")),
    grau: headers.findIndex((h) => h.includes("grau") || h.includes("hierarq")),
  };

  const strip = (v: string) => v.replace(/^"|"$/g, "").trim();
  const clean = (v: string) => {
    const s = strip(v);
    return s === "" ? "" : s;
  };

  return lines.slice(1).map((line) => {
    const cols = line.split(";").map((c) => c.trim());
    return {
      nome: colMap.nome >= 0 ? clean(cols[colMap.nome] || "") : "",
      cargo: colMap.cargo >= 0 ? clean(cols[colMap.cargo] || "") : "",
      departamento: colMap.departamento >= 0 ? clean(cols[colMap.departamento] || "") : "",
      superior: colMap.superior >= 0 ? clean(cols[colMap.superior] || "") : "",
      celular: colMap.celular >= 0 ? clean(cols[colMap.celular] || "") : "",
      grau: colMap.grau >= 0 ? clean(cols[colMap.grau] || "") : "",
    };
  });
}

function normalizeHierarchy(value: string): string | null {
  const v = value.toLowerCase().trim();
  if (["alto", "medio", "médio", "baixo"].includes(v)) {
    return v === "médio" ? "medio" : v;
  }
  return null;
}

export function useOrgImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importCsv = async (file: File): Promise<ImportResult> => {
    setIsImporting(true);
    setResult(null);

    const res: ImportResult = { imported: 0, updated: 0, errors: [] };

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        res.errors.push("Arquivo vazio ou formato inválido.");
        setResult(res);
        setIsImporting(false);
        return res;
      }

      // Fetch existing profiles for matching
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      const profileMap = new Map<string, string>();
      (profiles || []).forEach((p) => {
        if (p.full_name) profileMap.set(p.full_name.toLowerCase().trim(), p.id);
      });

      // Fetch current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        res.errors.push("Usuário não autenticado.");
        setResult(res);
        setIsImporting(false);
        return res;
      }

      // First pass: create/update profiles and contacts
      const nameToIdMap = new Map<string, string>(profileMap);
      const contactNames: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.nome) {
          res.errors.push(`Linha ${i + 2}: Nome vazio, ignorada.`);
          continue;
        }

        const nameKey = row.nome.toLowerCase().trim();
        const hierarchy = normalizeHierarchy(row.grau);

        if (profileMap.has(nameKey)) {
          // Update existing profile
          const profileId = profileMap.get(nameKey)!;
          const { error } = await supabase
            .from("profiles")
            .update({
              department: row.departamento || null,
              position: row.cargo || null,
              phone: row.celular || null,
              hierarchy_level: hierarchy,
            })
            .eq("id", profileId);

          if (error) {
            res.errors.push(`Linha ${i + 2} (${row.nome}): ${error.message}`);
          } else {
            res.updated++;
          }
        } else {
          // Create contact
          const { data: contact, error } = await supabase
            .from("contacts")
            .insert({
              full_name: row.nome,
              phone: row.celular || "N/A",
              department: row.departamento || null,
              position: row.cargo || null,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (error) {
            res.errors.push(`Linha ${i + 2} (${row.nome}): ${error.message}`);
          } else {
            res.imported++;
            nameToIdMap.set(nameKey, contact.id);
            contactNames.push(nameKey);
          }
        }
      }

      // Second pass: resolve superior_id for profiles only
      for (const row of rows) {
        if (!row.superior || !row.nome) continue;

        const nameKey = row.nome.toLowerCase().trim();
        const superiorKey = row.superior.toLowerCase().trim();
        const profileId = profileMap.get(nameKey);

        // Only update superior_id for existing profiles
        if (profileId && nameToIdMap.has(superiorKey)) {
          const superiorId = nameToIdMap.get(superiorKey)!;
          // Only link if superior is also a profile (not a contact)
          if (profileMap.has(superiorKey)) {
            await supabase
              .from("profiles")
              .update({ superior_id: superiorId })
              .eq("id", profileId);
          }
        }
      }

      // Save last import date
      localStorage.setItem(
        "semear_last_org_import",
        new Date().toISOString()
      );
    } catch (err: any) {
      res.errors.push(`Erro inesperado: ${err.message}`);
    }

    setResult(res);
    setIsImporting(false);
    return res;
  };

  const downloadTemplate = () => {
    const headers = "Nome;Cargo;Departamento;Superior direto;Celular;Grau hierárquico";
    const example = "João Silva;Gerente;Comercial;Maria Santos;11999998888;alto";
    const blob = new Blob([`${headers}\n${example}\n`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_organograma.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return { importCsv, downloadTemplate, isImporting, result };
}
