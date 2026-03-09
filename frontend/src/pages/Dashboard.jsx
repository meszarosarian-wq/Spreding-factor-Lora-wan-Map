import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { 
  Router, Radio, Activity, TrendingUp, 
  CalendarIcon, X, RefreshCw, Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/context/ThemeContext";
import { Badge } from "@/components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Gateway icon
const gatewayIcon = L.divIcon({
  className: "gateway-marker-icon",
  html: `<div style="
    width: 24px;
    height: 24px;
    background-color: #3b82f6;
    border: 3px solid #fafafa;
    border-radius: 4px;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Get SF color based on NOC rules:
// GREEN: SF <= 9 (excellent signal)
// ORANGE: SF = 10 (marginal signal)
// RED: SF >= 11 or offline > 24h
const getSFColor = (sfAvg, lastSeen) => {
  // Check if offline > 24h
  if (lastSeen) {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const hoursDiff = (now - lastSeenDate) / (1000 * 60 * 60);
    if (hoursDiff > 24) return "#ef4444"; // RED - offline
  }
  
  if (sfAvg === null || sfAvg === undefined) return "#71717a";
  if (sfAvg <= 9) return "#10b981";     // GREEN
  if (sfAvg <= 10) return "#f59e0b";    // ORANGE
  return "#ef4444";                      // RED
};

const getSFLabel = (sfAvg, lastSeen) => {
  // Check if offline > 24h
  if (lastSeen) {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const hoursDiff = (now - lastSeenDate) / (1000 * 60 * 60);
    if (hoursDiff > 24) return "Offline >24h";
  }
  
  if (sfAvg === null || sfAvg === undefined) return "N/A";
  if (sfAvg <= 9) return "Excelent";
  if (sfAvg <= 10) return "La limită";
  return "Critic";
};

const getMarkerRadius = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return 8;
  if (sfAvg <= 8.5) return 8;
  if (sfAvg <= 10.5) return 12;
  return 16;
};

// Component to auto-fit map bounds to data
function MapBoundsUpdater({ points, gateways }) {
  const map = useMap();
  
  useEffect(() => {
    const allPoints = [
      ...points.map(p => [p.latitude, p.longitude]),
      ...gateways.map(g => [g.latitude, g.longitude])
    ].filter(p => p[0] && p[1]);
    
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, gateways, map]);
  
  return null;
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [stats, setStats] = useState({
    total_gateways: 0,
    total_devices: 0,
    total_uplinks: 0,
    uplinks_today: 0,
    sf_distribution: {}
  });
  const [heatmapData, setHeatmapData] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState({ alerts: [], total: 0, critical: 0, warning: 0 });
  
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [groups, setGroups] = useState([]);

  // Map tile URLs
  const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const lightTileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedGateway && selectedGateway !== "all") {
        params.append("gateway_id", selectedGateway);
      }
      if (startDate) {
        params.append("start_date", startDate.toISOString());
      }
      if (endDate) {
        params.append("end_date", endDate.toISOString());
      }
      if (selectedGroup && selectedGroup !== "all") {
        params.append("group_id", selectedGroup);
      }
      
      const statsParams = new URLSearchParams();
      if (selectedGroup && selectedGroup !== "all") {
        statsParams.append("group_id", selectedGroup);
      }
      
      const [statsRes, heatmapRes, gatewaysRes, alertsRes, groupsRes] = await Promise.all([
        axios.get(`${API}/stats?${statsParams.toString()}`),
        axios.get(`${API}/heatmap?${params.toString()}`),
        axios.get(`${API}/gateways`),
        axios.get(`${API}/alerts`),
        axios.get(`${API}/groups`)
      ]);
      
      setStats(statsRes.data);
      setHeatmapData(heatmapRes.data);
      setGateways(gatewaysRes.data);
      setAlerts(alertsRes.data);
      setGroups(groupsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGateway, startDate, endDate, selectedGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearFilters = () => {
    setSelectedGateway("all");
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedGateway !== "all" || startDate || endDate;

  // Calculate map center dynamically based on data
  const mapCenter = useMemo(() => {
    const allPoints = [
      ...heatmapData.map(p => ({ lat: p.latitude, lng: p.longitude })),
      ...gateways.map(g => ({ lat: g.latitude, lng: g.longitude }))
    ].filter(p => p.lat && p.lng);
    
    if (allPoints.length === 0) {
      return [44.4268, 26.1025]; // Default to Bucharest
    }
    
    const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
    
    return [avgLat, avgLng];
  }, [heatmapData, gateways]);

  // Filter heatmap data based on toggles
  const filteredHeatmapData = useMemo(() => {
    let data = heatmapData;
    
    if (showCriticalOnly) {
      data = data.filter(p => {
        const sfAvg = p.sf_average ?? p.spreading_factor;
        return sfAvg !== null && sfAvg !== undefined && sfAvg > 10.5;
      });
    }
    
    return data;
  }, [heatmapData, showCriticalOnly]);

  // Check if device is inactive (>24h)
  const isDeviceInactive = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    return (now - lastSeenDate) / (1000 * 60 * 60) > 24;
  };

  // Dynamic classes based on theme
  const cardClass = theme === "dark" 
    ? "bg-zinc-900 border-zinc-800" 
    : "bg-white border-slate-200 shadow-sm";
  
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";

  return (
    <div className="space-y-4" data-testid="dashboard-page">
      {/* Stats Row */}
      <div className="bento-grid">
        <Card className={`${cardClass} card-hover`} data-testid="stat-gateways">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-mono uppercase tracking-wider ${textMuted}`}>Gateway-uri</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${textPrimary}`}>{stats.total_gateways}</p>
              </div>
              <Router className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${cardClass} card-hover`} data-testid="stat-devices">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-mono uppercase tracking-wider ${textMuted}`}>Dispozitive</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${textPrimary}`}>{stats.total_devices}</p>
              </div>
              <Radio className="w-8 h-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${cardClass} card-hover`} data-testid="stat-uplinks">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-mono uppercase tracking-wider ${textMuted}`}>Total Uplinks</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${textPrimary}`}>{stats.total_uplinks}</p>
              </div>
              <Activity className="w-8 h-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${cardClass} card-hover`} data-testid="stat-today">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-mono uppercase tracking-wider ${textMuted}`}>Uplinks Azi</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${textPrimary}`}>{stats.uplinks_today}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <Card className={cardClass} data-testid="filters-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono uppercase tracking-wider ${textMuted}`}>Filtre:</span>
            </div>
            
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <SelectTrigger 
                className={`w-[200px] ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}
                data-testid="filter-gateway"
              >
                <SelectValue placeholder="Toate Gateway-urile" />
              </SelectTrigger>
              <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                <SelectItem value="all" className={textSecondary}>Toate Gateway-urile</SelectItem>
                {gateways.map((gw) => (
                  <SelectItem key={gw.id} value={gw.id} className={textSecondary}>
                    {gw.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger 
                className={`w-[200px] ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}
                data-testid="filter-group"
              >
                <SelectValue placeholder="Toate Grupurile" />
              </SelectTrigger>
              <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                <SelectItem value="all" className={textSecondary}>Toate Grupurile</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} className={textSecondary}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}
                  data-testid="filter-start-date"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {startDate ? format(startDate, "dd MMM yyyy", { locale: ro }) : "Data început"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto p-0 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}
                  data-testid="filter-end-date"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {endDate ? format(endDate, "dd MMM yyyy", { locale: ro }) : "Data sfârșit"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto p-0 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearFilters}
                className={textSecondary}
                data-testid="clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Șterge filtre
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchData}
              className={`${textSecondary} ml-auto`}
              data-testid="refresh-data"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Reîmprospătare
            </Button>
          </div>
          
          {/* Map Filter Toggles */}
          <div className="flex flex-wrap items-center gap-6 mt-3 pt-3 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Switch
                id="critical-only"
                checked={showCriticalOnly}
                onCheckedChange={setShowCriticalOnly}
              />
              <Label htmlFor="critical-only" className={`text-xs cursor-pointer ${textSecondary}`}>
                Doar critice (SF &gt; 10.5)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className={`text-xs cursor-pointer ${textSecondary}`}>
                Arată inactive (&gt;24h) în gri
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Section */}
      <Card className={cardClass} data-testid="map-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className={`text-lg font-heading font-semibold ${textPrimary}`}>
                Hartă Acoperire SF
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className={`w-4 h-4 ${textMuted} cursor-help`} />
                  </TooltipTrigger>
                  <TooltipContent className={theme === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-slate-200"}>
                    <p className={`text-xs ${textSecondary}`}>
                      Culoarea fiecărui punct este calculată pe baza <strong>mediei ultimelor 10 valori SF</strong>.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className={`sf-legend ${theme === "dark" ? "bg-zinc-900/90 border-zinc-800" : "bg-white border-slate-200"}`}>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-good"></div>
                <span className={textSecondary}>≤SF9 Excelent</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-medium"></div>
                <span className={textSecondary}>SF10 La limită</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-bad"></div>
                <span className={textSecondary}>≥SF11 / Offline Critic</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="map-container" data-testid="coverage-map">
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
              key={`${theme}-${mapCenter[0].toFixed(2)}-${mapCenter[1].toFixed(2)}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={theme === "dark" ? darkTileUrl : lightTileUrl}
              />
              
              <MapBoundsUpdater points={heatmapData} gateways={gateways} />
              
              {gateways.map((gateway) => (
                <Marker
                  key={gateway.id}
                  position={[gateway.latitude, gateway.longitude]}
                  icon={gatewayIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <p className={`font-bold text-sm ${textPrimary}`}>{gateway.name}</p>
                      {gateway.dev_eui && (
                        <p className="text-xs text-blue-400 font-mono mt-1">
                          DevEUI: {gateway.dev_eui}
                        </p>
                      )}
                      <p className={`text-xs font-mono mt-1 ${textMuted}`}>
                        {gateway.latitude.toFixed(6)}, {gateway.longitude.toFixed(6)}
                      </p>
                      <span className={`badge mt-2 ${gateway.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {gateway.status === 'active' ? 'Activ' : 'Inactiv'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {filteredHeatmapData.map((point) => {
                const sfValue = point.sf_average ?? point.spreading_factor;
                const inactive = isDeviceInactive(point.last_seen);
                const color = (showInactive && inactive) ? "#71717a" : getSFColor(sfValue, point.last_seen);
                const radius = getMarkerRadius(sfValue);
                
                return (
                  <CircleMarker
                    key={point.dev_eui}
                    center={[point.latitude, point.longitude]}
                    radius={radius}
                    fillColor={color}
                    fillOpacity={0.7}
                    stroke={true}
                    color={theme === "dark" ? "#fafafa" : "#1e293b"}
                    weight={1}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <p className={`font-bold text-sm ${textPrimary}`}>{point.name}</p>
                        <p className={`text-xs font-mono ${textMuted}`}>{point.dev_eui}</p>
                        
                        <div className={`mt-3 p-2 rounded border ${theme === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-slate-50 border-slate-200"}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-semibold ${textSecondary}`}>Media SF:</span>
                            <span className="font-mono font-bold text-lg" style={{ color }}>
                              {sfValue !== null && sfValue !== undefined ? sfValue.toFixed(1) : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className={textMuted}>Calitate:</span>
                            <span style={{ color }}>{getSFLabel(sfValue, point.last_seen)}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          {point.rssi !== null && (
                            <div className="flex justify-between text-xs">
                              <span className={textSecondary}>RSSI:</span>
                              <span className={`font-mono ${textSecondary}`}>{point.rssi} dBm</span>
                            </div>
                          )}
                          {point.snr !== null && (
                            <div className="flex justify-between text-xs">
                              <span className={textSecondary}>SNR:</span>
                              <span className={`font-mono ${textSecondary}`}>{point.snr} dB</span>
                            </div>
                          )}
                          {point.packets_lost > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className={textSecondary}>Pachete pierdute:</span>
                              <span className="font-mono text-red-500 font-bold">{point.packets_lost}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* NOC Alerts Panel */}
      {alerts.total > 0 && (
        <Card className={`${cardClass} border-l-4 ${alerts.critical > 0 ? "border-l-red-500" : "border-l-amber-500"}`} data-testid="alerts-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
                ⚠️ Alerte NOC
              </CardTitle>
              <Badge variant="destructive" className="text-xs">
                {alerts.critical > 0 ? `${alerts.critical} critice` : `${alerts.warning} avertismente`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {alerts.alerts.slice(0, 6).map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded border text-xs ${
                    alert.severity === "critical"
                      ? "text-red-500 bg-red-500/10 border-red-500/30"
                      : "text-amber-500 bg-amber-500/10 border-amber-500/30"
                  }`}
                >
                  <span className="font-bold">{alert.type === "packet_loss" ? "📡" : alert.type === "low_battery" ? "🔋" : "📴"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold truncate block">{alert.device_name}</span>
                    <span className="opacity-75 truncate block">{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
