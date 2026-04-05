import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, CalendarDays, FolderOpen, Repeat } from "lucide-react";

const tabs = [
  { path: "/app/feed", label: "Feed", icon: Home },
  { path: "/app/people", label: "Pessoas", icon: Users },
  { path: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { path: "/app/projects", label: "Projetos", icon: FolderOpen },
  { path: "/app/rituals", label: "Rituais", icon: Repeat },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#EEEEE9] flex items-center justify-around z-50">
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = location.pathname.startsWith(path);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] gap-0.5"
          >
            <Icon size={20} className={active ? "text-[#4F46E5]" : "text-[#94A3B8]"} />
            <span className={`text-[10px] leading-tight ${active ? "text-[#4F46E5] font-medium" : "text-[#94A3B8]"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
