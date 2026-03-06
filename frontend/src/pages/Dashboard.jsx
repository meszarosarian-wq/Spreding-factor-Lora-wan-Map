import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker } from "react-leaflet";
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
  CalendarIcon, X, RefreshCw
} from "lucide-react";

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

// Get SF color based on spreading factor
const getSFColor = (sf) => {
  if (sf === null || sf === undefined) return "#71717a";
  if (sf <= 8) return "#10b981"; // Green - Good
  if (sf <= 10) return "#f59e0b"; // Orange - Medium
  return "#ef4444"; // Red - Bad
};

const getSFLabel = (sf) => {
  if (sf === null || sf === undefined) return "N/A";
  if (sf <= 8) return "Excelent";
  if (sf <= 10) return "Mediu";
  return "Limită";
};

export default function Dashboard() {
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
  
  // Filters
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Build query params
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

  return (
    <div className="space-y-4" data-testid="dashboard-page">
      {/* Stats Row */}
      <div className="bento-grid">
        <Card className="card-base card-hover" data-testid="stat-gateways">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Gateway-uri</p>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.total_gateways}</p>
              </div>
              <Router className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base card-hover" data-testid="stat-devices">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Dispozitive</p>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.total_devices}</p>
              </div>
              <Radio className="w-8 h-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base card-hover" data-testid="stat-uplinks">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Total Uplinks</p>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.total_uplinks}</p>
              </div>
              <Activity className="w-8 h-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base card-hover" data-testid="stat-today">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Uplinks Azi</p>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.uplinks_today}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <Card className="card-base" data-testid="filters-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Filtre:</span>
            </div>
            
            {/* Gateway Filter */}
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <SelectTrigger 
                className="w-[200px] bg-zinc-950 border-zinc-800 text-zinc-300"
                data-testid="filter-gateway"
              >
                <SelectValue placeholder="Toate Gateway-urile" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all" className="text-zinc-300">Toate Gateway-urile</SelectItem>
                {gateways.map((gw) => (
                  <SelectItem key={gw.id} value={gw.id} className="text-zinc-300">
                    {gw.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  data-testid="filter-start-date"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {startDate ? format(startDate, "dd MMM yyyy", { locale: ro }) : "Data început"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  className="bg-zinc-900"
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  data-testid="filter-end-date"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {endDate ? format(endDate, "dd MMM yyyy", { locale: ro }) : "Data sfârșit"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  className="bg-zinc-900"
                />
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearFilters}
                className="text-zinc-400 hover:text-white"
                data-testid="clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Șterge filtre
              </Button>
            )}

            {/* Refresh */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchData}
              className="text-zinc-400 hover:text-white ml-auto"
              data-testid="refresh-data"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Reîmprospătare
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Map Section */}
      <Card className="card-base" data-testid="map-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading font-semibold text-zinc-100">
              Hartă Acoperire SF
            </CardTitle>
            
            {/* Legend */}
            <div className="sf-legend">
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-good"></div>
                <span className="text-zinc-400">SF7-8 Excelent</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-medium"></div>
                <span className="text-zinc-400">SF9-10 Mediu</span>
              </div>
              <div className="sf-legend-item">
                <div className="sf-dot sf-dot-bad"></div>
                <span className="text-zinc-400">SF11-12 Limită</span>
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
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Render Gateways */}
              {gateways.map((gateway) => (
                <Marker
                  key={gateway.id}
                  position={[gateway.latitude, gateway.longitude]}
                  icon={gatewayIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-bold text-sm text-white">{gateway.name}</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">
                        {gateway.latitude.toFixed(6)}, {gateway.longitude.toFixed(6)}
                      </p>
                      <span className={`badge mt-2 ${gateway.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {gateway.status === 'active' ? 'Activ' : 'Inactiv'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Render Device Heatmap Points */}
              {heatmapData.map((point) => (
                <CircleMarker
                  key={point.dev_eui}
                  center={[point.latitude, point.longitude]}
                  radius={10}
                  fillColor={getSFColor(point.spreading_factor)}
                  fillOpacity={0.8}
                  stroke={true}
                  color="#fafafa"
                  weight={1}
                  data-testid={`device-marker-${point.dev_eui}`}
                >
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <p className="font-bold text-sm text-white">{point.name}</p>
                      <p className="text-xs text-zinc-500 font-mono">{point.dev_eui}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">SF:</span>
                          <span 
                            className="font-mono font-bold"
                            style={{ color: getSFColor(point.spreading_factor) }}
                          >
                            {point.spreading_factor ?? "N/A"} ({getSFLabel(point.spreading_factor)})
                          </span>
                        </div>
                        {point.rssi !== null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">RSSI:</span>
                            <span className="font-mono text-zinc-300">{point.rssi} dBm</span>
                          </div>
                        )}
                        {point.snr !== null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">SNR:</span>
                            <span className="font-mono text-zinc-300">{point.snr} dB</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">Coordonate:</span>
                          <span className="font-mono text-zinc-300">
                            {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
