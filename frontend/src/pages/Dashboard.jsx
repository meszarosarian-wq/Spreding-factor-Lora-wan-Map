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

// Get SF color based on AVERAGE spreading factor
const getSFColor = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "#71717a";
  if (sfAvg <= 8.5) return "#10b981";
  if (sfAvg <= 10.5) return "#f59e0b";
  return "#ef4444";
};

const getSFLabel = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "N/A";
  if (sfAvg <= 8.5) return "Excelent";
  if (sfAvg <= 10.5) return "Mediu";
  return "Limită";
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
  
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

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
      
      const [statsRes, heatmapRes, gatewaysRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/heatmap?${params.toString()}`),
        axios.get(`${API}/gateways`)
      ]);
      
      setStats(statsRes.data);
      setHeatmapData(heatmapRes.data);
      setGateways(gatewaysRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGateway, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearFilters = () => {
    setSelectedGateway("all");
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedGateway !== "all" || startDate || endDate;

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
                <span className={textSecondary}>≤8.5 Excelent</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-medium"></div>
                <span className={textSecondary}>8.6-10.5 Mediu</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-bad"></div>
                <span className={textSecondary}>&gt;10.5 Limită</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="map-container" data-testid="coverage-map">
            <MapContainer
              center={[44.4268, 26.1025]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
              key={theme}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={theme === "dark" ? darkTileUrl : lightTileUrl}
              />
              
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

              {heatmapData.map((point) => {
                const sfValue = point.sf_average ?? point.spreading_factor;
                const color = getSFColor(sfValue);
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
                              {sfValue !== null ? sfValue.toFixed(1) : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className={textMuted}>Calitate:</span>
                            <span style={{ color }}>{getSFLabel(sfValue)}</span>
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
    </div>
  );
}
