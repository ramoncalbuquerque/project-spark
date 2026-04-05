import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./components/AppLayout";
import AppShellV2 from "./components/AppShellV2";
import Dashboard from "./pages/Dashboard";
import Teams from "./pages/Teams";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import FeedPage from "./pages/v2/FeedPage";
import PeoplePage from "./pages/v2/PeoplePage";
import AgendaPage from "./pages/v2/AgendaPage";
import ProjectsPage from "./pages/v2/ProjectsPage";
import RitualsPage from "./pages/v2/RitualsPage";
import TaskDetailPage from "./pages/v2/TaskDetailPage";
import ProjectDetailPage from "./pages/v2/ProjectDetailPage";
import RitualDetailPage from "./pages/v2/RitualDetailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* v2 layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShellV2 />
                </ProtectedRoute>
              }
            >
              <Route path="/app/feed" element={<FeedPage />} />
              <Route path="/app/people" element={<PeoplePage />} />
              <Route path="/app/agenda" element={<AgendaPage />} />
              <Route path="/app/projects" element={<ProjectsPage />} />
              <Route path="/app/rituals" element={<RitualsPage />} />
              <Route path="/app/profile" element={<Profile />} />
              <Route path="/app/task/:id" element={<TaskDetailPage />} />
              <Route path="/app/project/:id" element={<ProjectDetailPage />} />
              <Route path="/app/ritual/:id" element={<RitualDetailPage />} />
            </Route>

            {/* v1 layout (mantido) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>

            <Route path="/" element={<Navigate to="/app/feed" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
