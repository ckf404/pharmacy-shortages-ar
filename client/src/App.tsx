import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import Login from "./pages/Login";
import Shortages from "./pages/Shortages";
import Suppliers from "./pages/Suppliers";
import Profile from "./pages/Profile";
import { UsersPage } from "./pages/Management";
import SettingsPage from "./pages/SettingsPage";
import SupervisorControls from "./pages/SupervisorControls";
import { Loader2, ShieldAlert } from "lucide-react";
import { hasPermission } from "./lib/permissions";

function NotAllowed() { return <div className="panel flex min-h-72 flex-col items-center justify-center text-center"><ShieldAlert className="h-9 w-9 text-amber-600" /><h1 className="mt-4 text-xl font-bold">لا تملك صلاحية الوصول لهذه الصفحة</h1><p className="mt-2 text-sm text-slate-500">اطلب من مدير النظام تعديل دور حسابك عند الحاجة.</p></div>; }

function Router() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader min-h-screen"><Loader2 className="h-6 w-6 animate-spin" />جاري التحقق من الدخول…</div>;
  if (!user) return <Login />;
  return <DashboardLayout><Switch>
    <Route path="/" component={Shortages} />
    <Route path="/profile" component={Profile} />
    <Route path="/suppliers">{hasPermission(user, "suppliers_manage") ? <Suppliers /> : <NotAllowed />}</Route>
    <Route path="/users">{hasPermission(user, "users_manage") ? <UsersPage /> : <NotAllowed />}</Route>
    <Route path="/settings/control">{hasPermission(user, "settings_manage") ? <SupervisorControls /> : <NotAllowed />}</Route>
    <Route path="/settings">{hasPermission(user, "messages_manage") || hasPermission(user, "settings_manage") || hasPermission(user, "rollover_manage") ? <SettingsPage /> : <NotAllowed />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
