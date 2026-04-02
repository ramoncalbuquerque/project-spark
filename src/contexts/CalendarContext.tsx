import { createContext, useContext, useState, ReactNode } from "react";
import { addDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";

type ViewMode = "day" | "week" | "month";

export interface CalendarFilters {
  profileId: string | null;
  teamId: string | null;
  status: string | null;
  cardType: string | null;
  priority: string | null;
}

interface CalendarContextType {
  selectedDate: Date;
  viewMode: ViewMode;
  filters: CalendarFilters;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilters: (f: CalendarFilters) => void;
  clearFilters: () => void;
  goToToday: () => void;
  goNext: () => void;
  goPrev: () => void;
}

const defaultFilters: CalendarFilters = {
  profileId: null,
  teamId: null,
  status: null,
  cardType: null,
  priority: null,
};

const defaultValue: CalendarContextType = {
  selectedDate: new Date(),
  viewMode: "week",
  filters: defaultFilters,
  setSelectedDate: () => {},
  setViewMode: () => {},
  setFilters: () => {},
  clearFilters: () => {},
  goToToday: () => {},
  goNext: () => {},
  goPrev: () => {},
};

const CalendarContext = createContext<CalendarContextType>(defaultValue);

export const useCalendar = () => useContext(CalendarContext);

export const CalendarProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filters, setFilters] = useState<CalendarFilters>(defaultFilters);

  const clearFilters = () => setFilters(defaultFilters);

  const goToToday = () => setSelectedDate(new Date());

  const goNext = () => {
    setSelectedDate((d) => {
      if (viewMode === "day") return addDays(d, 1);
      if (viewMode === "week") return addWeeks(d, 1);
      return addMonths(d, 1);
    });
  };

  const goPrev = () => {
    setSelectedDate((d) => {
      if (viewMode === "day") return addDays(d, -1);
      if (viewMode === "week") return subWeeks(d, 1);
      return subMonths(d, 1);
    });
  };

  return (
    <CalendarContext.Provider
      value={{ selectedDate, viewMode, filters, setSelectedDate, setViewMode, setFilters, clearFilters, goToToday, goNext, goPrev }}
    >
      {children}
    </CalendarContext.Provider>
  );
};
