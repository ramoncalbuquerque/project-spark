import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import MonthView from "@/components/calendar/MonthView";
import { useCalendar } from "@/contexts/CalendarContext";

const Dashboard = () => {
  const { viewMode } = useCalendar();

  return (
    <div className="flex flex-col h-full">
      <CalendarToolbar />
      <div className="flex-1 min-h-0">
        {viewMode === "week" && <WeekView />}
        {viewMode === "day" && <DayView />}
        {viewMode === "month" && <MonthView />}
      </div>
    </div>
  );
};

export default Dashboard;
