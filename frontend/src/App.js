import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { Radio, Router, Activity, List, Map, Sun, Moon, Zap, BarChart3, Bell, FolderOpen } from "lucide-react";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Pages
import Dashboard from "@/pages/Dashboard";
import Gateways from "@/pages/Gateways";
import Devices from "@/pages/Devices";
import UplinkLogs from "@/pages/UplinkLogs";
import LiveFeed from "@/pages/LiveFeed";
import Analytics from "@/pages/Analytics";
import Groups from "@/pages/Groups";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Seed demo data on first load
const seedDemoData = async () => {
  try {
    await axios.post(`${API}/seed`);
  } catch (e) {
    console.log("Seed check complete");
  }
};

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-9 h-9 p-0"
            data-testid="theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{theme === "dark" ? "Mod luminos" : "Mod întunecat"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const NotificationBell = () => {
  const { theme } = useTheme();
  const [alerts, setAlerts] = useState({ alerts: [], total: 0, critical: 0 });
  
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts`);
      setAlerts(res.data);
    } catch (e) {
      // silently fail
    }
  }, []);
  
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);
  
  const criticalCount = alerts.critical + alerts.warning;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-9 h-9 p-0 relative">
          <Bell className={`w-5 h-5 ${criticalCount > 0 ? "text-red-500" : theme === "dark" ? "text-zinc-400" : "text-slate-600"}`} />
          {criticalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {criticalCount > 99 ? "99+" : criticalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={`w-80 max-h-96 overflow-y-auto ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}
      >
        <DropdownMenuLabel className={`text-xs font-mono uppercase ${theme === "dark" ? "text-zinc-400" : "text-slate-500"}`}>
          Alerte NOC ({criticalCount})
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={theme === "dark" ? "bg-zinc-800" : "bg-slate-200"} />
        {alerts.alerts.length === 0 ? (
          <div className={`p-3 text-sm text-center ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
            Fără alerte active
          </div>
        ) : (
          alerts.alerts.slice(0, 15).map((alert, idx) => (
            <DropdownMenuItem key={idx} className={`flex items-start gap-2 p-2 cursor-default focus:bg-transparent ${
              alert.severity === "critical" ? "text-red-500" : "text-amber-500"
            }`}>
              <span className="mt-0.5">{alert.type === "sf_critical" ? "🔴" : alert.type === "packet_loss" ? "📡" : "📴"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs truncate">{alert.device_name}</p>
                <p className={`text-xs truncate ${theme === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
                  {alert.dev_eui} • SF: {alert.sf_average ?? "N/A"}
                </p>
                <p className="text-xs opacity-80">{alert.message}</p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Navigation = () => {
  const location = useLocation();
  const { theme } = useTheme();
  
  const navItems = [
    { path: "/", icon: Map, label: "Harta SF" },
    { path: "/live", icon: Zap, label: "Live Feed" },
    { path: "/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/groups", icon: FolderOpen, label: "Grupuri" },
    { path: "/gateways", icon: Router, label: "Gateway-uri" },
    { path: "/devices", icon: Radio, label: "Dispozitive" },
    { path: "/logs", icon: List, label: "Istoric" },
  ];

  return (
    <header 
      className={`h-16 border-b sticky top-0 z-50 ${
        theme === "dark" 
          ? "border-zinc-800 bg-zinc-950/80 backdrop-blur-xl" 
          : "border-slate-200 bg-white/80 backdrop-blur-xl"
      }`}
      data-testid="main-header"
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <span className={`font-heading font-bold text-lg tracking-tight ${
            theme === "dark" ? "text-white" : "text-slate-900"
          }`}>
            LoRaWAN Monitor
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1" data-testid="main-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.path === "/" ? "dashboard" : item.path.slice(1)}`}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium
                    transition-all duration-200
                    ${isActive 
                      ? "bg-blue-600/20 text-blue-500 border border-blue-500/30" 
                      : theme === "dark"
                        ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          
          <div className={`w-px h-6 ${theme === "dark" ? "bg-zinc-700" : "bg-slate-200"}`} />
          
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

function AppContent() {
  const { theme } = useTheme();
  
  useEffect(() => {
    seedDemoData();
  }, []);

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-slate-50"}`}>
      <BrowserRouter>
        <Navigation />
        <main className="p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live" element={<LiveFeed />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/gateways" element={<Gateways />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/logs" element={<UplinkLogs />} />
          </Routes>
        </main>
      </BrowserRouter>
      <Toaster position="bottom-right" theme={theme} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
