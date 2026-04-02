import { createContext, useContext, useState, ReactNode } from "react";
import { startOfWeek, addDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";

type ViewMode = "day" | "week" | "month";

interface CalendarContextType {
  selectedDate: Date;
  viewMode: ViewMode;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  goToToday: () => void;
  goNext: () => void;
  goPrev: () => void;
}

const defaultValue: CalendarContextType = {
  selectedDate: new Date(),
  viewMode: "week",
  setSelectedDate: () => {},
  setViewMode: () => {},
  goToToday: () => {},
  goNext: () => {},
  goPrev: () => {},
};

const CalendarContext = createContext<CalendarContextType>(defaultValue);

export const useCalendar = () => useContext(CalendarContext);

export const CalendarProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");

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
      value={{ selectedDate, viewMode, setSelectedDate, setViewMode, goToToday, goNext, goPrev }}
    >
      {children}
    </CalendarContext.Provider>
  );
};
