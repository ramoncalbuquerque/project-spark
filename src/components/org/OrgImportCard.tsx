import { useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgImport } from "@/hooks/useOrgImport";

export function OrgImportCard() {
  const { importCsv, downloadTemplate, isImporting, result } = useOrgImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastImport] = useState(() =>
    localStorage.getItem("semear_last_org_import")
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importCsv(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Importar Organograma</CardTitle>
        </div>
        <CardDescription>
          Importe uma planilha CSV para popular o organograma com pessoas, cargos e departamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastImport && (
          <p className="text-sm text-muted-foreground">
            Última importação:{" "}
            {new Date(lastImport).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isImporting ? "Importando..." : "Importar planilha"}
          </Button>

          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Baixar modelo CSV
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />

        {result && (
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="font-medium text-sm">Resultado da importação</h4>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {result.imported} importado{result.imported !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1 text-blue-600">
                <CheckCircle2 className="h-4 w-4" />
                {result.updated} atualizado{result.updated !== 1 ? "s" : ""}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive flex items-start gap-1">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
