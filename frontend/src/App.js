import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { Radio, Router, Activity, List, Map } from "lucide-react";

// Pages
import Dashboard from "@/pages/Dashboard";
import Gateways from "@/pages/Gateways";
import Devices from "@/pages/Devices";
import UplinkLogs from "@/pages/UplinkLogs";

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

const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", icon: Map, label: "Harta SF" },
    { path: "/gateways", icon: Router, label: "Gateway-uri" },
    { path: "/devices", icon: Radio, label: "Dispozitive" },
    { path: "/logs", icon: List, label: "Uplink Logs" },
  ];

  return (
    <header 
      className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50"
      data-testid="main-header"
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <span className="font-heading font-bold text-lg text-white tracking-tight">
            LoRaWAN Monitor
          </span>
        </div>
        
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
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

function App() {
  useEffect(() => {
    seedDemoData();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <BrowserRouter>
        <Navigation />
        <main className="p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gateways" element={<Gateways />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/logs" element={<UplinkLogs />} />
          </Routes>
        </main>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;
