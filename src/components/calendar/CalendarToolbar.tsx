import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/contexts/CalendarContext";
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const CalendarToolbar = () => {
  const { selectedDate, viewMode, setViewMode, goNext, goPrev, goToToday } =
    useCalendar();

  const getLabel = () => {
    if (viewMode === "day") {
      return format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      });
    }
    if (viewMode === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
      const sameYear = isSameYear(start, end);
      if (sameYear) {
        return `Semana de ${format(start, "d MMM", { locale: ptBR })} - ${format(end, "d MMM, yyyy", { locale: ptBR })}`;
      }
      return `${format(start, "d MMM yyyy", { locale: ptBR })} - ${format(end, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const views: { label: string; value: "day" | "week" | "month" }[] = [
    { label: "Dia", value: "day" },
    { label: "Semana", value: "week" },
    { label: "Mês", value: "month" },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goToToday}>
          Hoje
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground capitalize ml-1 whitespace-nowrap">
          {getLabel()}
        </span>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden">
        {views.map((v) => (
          <button
            key={v.value}
            onClick={() => setViewMode(v.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === v.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-accent"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarToolbar;
