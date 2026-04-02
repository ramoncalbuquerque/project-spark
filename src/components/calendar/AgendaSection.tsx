import { useState, useCallback, useRef } from "react";
import { useAgendaItems } from "@/hooks/useAgendaItems";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface AgendaSectionProps {
  cardId: string;
  isLeader: boolean;
}

const AgendaSection = ({ cardId, isLeader }: AgendaSectionProps) => {
  const { items, addItem, toggleItem, deleteItem, reorderItems } = useAgendaItems(cardId);
  const [newItem, setNewItem] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const handleAdd = useCallback(() => {
    const text = newItem.trim();
    if (!text) return;
    addItem.mutate(text);
    setNewItem("");
  }, [newItem, addItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = () => {
    if (dragIdx === null || dragOverIdx.current === null || dragIdx === dragOverIdx.current) {
      setDragIdx(null);
      return;
    }
    const ordered = [...items];
    const [moved] = ordered.splice(dragIdx, 1);
    ordered.splice(dragOverIdx.current, 0, moved);
    reorderItems.mutate(ordered.map((i) => i.id));
    setDragIdx(null);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        📝 Pauta
      </h4>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum item de pauta ainda.</p>
      )}

      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 group rounded px-1 py-1 min-h-[36px] ${
              dragIdx === idx ? "opacity-40" : ""
            } hover:bg-muted/50`}
            draggable={isLeader}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {isLeader && (
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab shrink-0" />
            )}
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(v) =>
                toggleItem.mutate({ id: item.id, is_completed: !!v })
              }
              className="shrink-0 h-5 w-5"
            />
            <span
              className={`text-sm flex-1 ${
                item.is_completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {item.content}
            </span>
            {isLeader && hoveredId === item.id && (
              <button
                onClick={() => deleteItem.mutate(item.id)}
                className="shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isLeader && (
        <div className="flex items-center gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicionar item..."
            className="h-9 text-sm flex-1"
          />
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={handleAdd}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AgendaSection;
