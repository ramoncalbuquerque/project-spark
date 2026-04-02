import { useRef } from "react";
import { useAttachments } from "@/hooks/useAttachments";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Download, FileIcon, ImageIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface AttachmentsSectionProps {
  cardId: string;
  cardCreatedBy: string;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
}

const AttachmentsSection = ({ cardId, cardCreatedBy }: AttachmentsSectionProps) => {
  const { user } = useAuth();
  const { attachments, uploadFile, deleteFile, getDownloadUrl } = useAttachments(cardId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canDelete = (att: Tables<"attachments">) =>
    user?.id === att.uploaded_by || user?.id === cardCreatedBy;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => uploadFile.mutate(file));
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        📎 Anexos
      </h4>

      {attachments.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
      )}

      <div className="space-y-1.5">
        {attachments.map((att) => {
          const url = getDownloadUrl(att.file_url);
          const imgPreview = isImage(att.file_name);
          return (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded border border-border px-2 py-1.5 bg-muted/30 group min-h-[40px]"
            >
              {imgPreview ? (
                <div className="h-8 w-8 rounded overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                  <img
                    src={url}
                    alt={att.file_name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{att.file_name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(att.file_size)}</p>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="shrink-0 p-1 rounded hover:bg-muted"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
              {canDelete(att) && (
                <button
                  onClick={() => deleteFile.mutate(att)}
                  className="shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadFile.isPending}
        >
          <Paperclip className="h-4 w-4" />
          {uploadFile.isPending ? "Enviando..." : "Anexar arquivo"}
        </Button>
      </div>
    </div>
  );
};

export default AttachmentsSection;
