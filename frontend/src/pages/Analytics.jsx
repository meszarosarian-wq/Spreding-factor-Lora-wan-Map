import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  AlertTriangle, Wifi, WifiOff, BarChart3, PieChart as PieChartIcon,
  Activity, TrendingDown, RefreshCw, Radio
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SF_COLORS = {
  SF7: "#10b981",
  SF8: "#34d399",
  SF9: "#fbbf24",
  SF10: "#f59e0b",
  SF11: "#ef4444",
  SF12: "#dc2626",
  Unknown: "#71717a"
};

export default function Analytics() {
  const { theme } = useTheme();
  const [sfDistribution, setSfDistribution] = useState({ distribution: [], total_uplinks: 0 });
  const [topProblematic, setTopProblematic] = useState({ nodes: [], metric: "packet_loss", label: "" });
  const [rfQuality, setRfQuality] = useState({ uplinks: [], device_name: "", dev_eui: "" });
  const [gatewayLoad, setGatewayLoad] = useState({ hourly_data: [], gateways: [] });
  const [alerts, setAlerts] = useState({ alerts: [], total: 0, critical: 0, warning: 0 });
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [problemMetric, setProblemMetric] = useState("packet_loss");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [groups, setGroups] = useState([]);
  const [noiseData, setNoiseData] = useState({ noise_devices: [], total_noise_messages: 0, noise_percentage: 0, unique_noise_devices: 0, total_registered_messages: 0 });
  const [loading, setLoading] = useState(true);

  // Theme-based colors
  const cardClass = theme === "dark"
    ? "bg-zinc-900 border-zinc-800"
    : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const gridColor = theme === "dark" ? "#3f3f46" : "#e2e8f0";
  const tooltipBg = theme === "dark" ? "#18181b" : "#ffffff";
  const tooltipBorder = theme === "dark" ? "#3f3f46" : "#e2e8f0";

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts`);
      setAlerts(res.data);
    } catch (e) {
      console.error("Error fetching alerts:", e);
    }
  }, []);

  const fetchSfDistribution = useCallback(async () => {
    try {
      const params = selectedGroupFilter && selectedGroupFilter !== "all" ? `?group_id=${selectedGroupFilter}` : "";
      const res = await axios.get(`${API}/analytics/sf-distribution${params}`);
      setSfDistribution(res.data);
    } catch (e) {
      console.error("Error fetching SF distribution:", e);
    }
  }, [selectedGroupFilter]);

  const fetchTopProblematic = useCallback(async () => {
    try {
      let params = `?metric=${problemMetric}`;
      if (selectedGroupFilter && selectedGroupFilter !== "all") params += `&group_id=${selectedGroupFilter}`;
      const res = await axios.get(`${API}/analytics/top-problematic${params}`);
      setTopProblematic(res.data);
    } catch (e) {
      console.error("Error fetching top problematic:", e);
    }
  }, [problemMetric, selectedGroupFilter]);

  const fetchRfQuality = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await axios.get(`${API}/analytics/rf-quality/${selectedDevice}?days=7`);
      setRfQuality(res.data);
    } catch (e) {
      console.error("Error fetching RF quality:", e);
    }
  }, [selectedDevice]);

  const fetchGatewayLoad = useCallback(async () => {
    try {
      const params = selectedGateway && selectedGateway !== "all" ? `?gateway_id=${selectedGateway}` : "";
      const res = await axios.get(`${API}/analytics/gateway-load${params}`);
      setGatewayLoad(res.data);
    } catch (e) {
      console.error("Error fetching gateway load:", e);
    }
  }, [selectedGateway]);

  const fetchDevices = useCallback(async () => {
    try {
      const [devRes, grpRes] = await Promise.all([
        axios.get(`${API}/analytics/device-list`),
        axios.get(`${API}/groups`)
      ]);
      setDevices(devRes.data);
      setGroups(grpRes.data);
      if (devRes.data.length > 0 && !selectedDevice) {
        setSelectedDevice(devRes.data[0].dev_eui);
      }
    } catch (e) {
      console.error("Error fetching device list:", e);
    }
  }, [selectedDevice]);

  const fetchNoise = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/analytics/noise`);
      setNoiseData(res.data);
    } catch (e) {
      console.error("Error fetching noise data:", e);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAlerts(), fetchSfDistribution(), fetchDevices(), fetchNoise()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchAlerts, fetchSfDistribution, fetchDevices, fetchNoise]);

  useEffect(() => {
    fetchTopProblematic();
  }, [fetchTopProblematic]);

  useEffect(() => {
    fetchRfQuality();
  }, [fetchRfQuality]);

  useEffect(() => {
    fetchGatewayLoad();
  }, [fetchGatewayLoad]);

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchAlerts(),
      fetchSfDistribution(),
      fetchTopProblematic(),
      fetchRfQuality(),
      fetchGatewayLoad(),
      fetchNoise()
    ]);
    setLoading(false);
  };

  // Custom Donut Label
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, sf }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
        {sf}
      </text>
    );
  };

  // Format RF quality data for time-based display
  const rfDataFormatted = rfQuality.uplinks.map((u, idx) => ({
    ...u,
    index: idx,
    time: u.timestamp ? new Date(u.timestamp).toLocaleString("ro-RO", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    }) : idx,
  }));

  // Filter devices for search
  const filteredDevices = devices.filter(d => {
    if (!deviceSearch) return true;
    const search = deviceSearch.toLowerCase();
    return (d.name || "").toLowerCase().includes(search) || (d.dev_eui || "").toLowerCase().includes(search);
  });

  // Format gateway load data
  const gatewayLoadFormatted = gatewayLoad.hourly_data.map(d => ({
    ...d,
    label: d.hour ? d.hour.split("T")[1] + ":00" : "",
    date: d.hour ? d.hour.split("T")[0] : ""
  }));

  const getSeverityColor = (severity) => {
    if (severity === "critical") return "text-red-500 bg-red-500/10 border-red-500/30";
    return "text-amber-500 bg-amber-500/10 border-amber-500/30";
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "packet_loss": return <WifiOff className="w-4 h-4" />;
      case "sf_critical": return <AlertTriangle className="w-4 h-4" />;
      case "offline": return <Wifi className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getAlertTypeLabel = (type) => {
    switch (type) {
      case "packet_loss": return "Packet Loss";
      case "sf_critical": return "SF Critic";
      case "offline": return "Offline";
      default: return type;
    }
  };

  return (
    <div className="space-y-4" data-testid="analytics-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className={`text-xl font-heading font-bold ${textPrimary}`}>
          <BarChart3 className="w-6 h-6 inline-block mr-2 text-blue-500" />
          NOC Analytics
        </h1>
        <div className="flex items-center gap-2">
          <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
            <SelectTrigger className={`w-[180px] h-8 text-xs ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}>
              <SelectValue placeholder="Toate Grupurile" />
            </SelectTrigger>
            <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
              <SelectItem value="all" className={textSecondary}>Toate Grupurile</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id} className={textSecondary}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAll}
            className={textSecondary}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Reîmprospătare
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      <Card className={`${cardClass} border-l-4 ${alerts.critical > 0 ? "border-l-red-500" : alerts.warning > 0 ? "border-l-amber-500" : "border-l-emerald-500"}`}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
            <AlertTriangle className={`w-5 h-5 ${alerts.critical > 0 ? "text-red-500" : alerts.warning > 0 ? "text-amber-500" : "text-emerald-500"}`} />
            Alerte NOC
            {alerts.total > 0 && (
              <span className="text-xs font-mono bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                {alerts.total} active
              </span>
            )}
            {alerts.total === 0 && (
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                Fără alerte
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {alerts.alerts.length === 0 ? (
            <p className={`text-sm ${textMuted}`}>Toate dispozitivele funcționează normal.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {alerts.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded border text-xs ${getSeverityColor(alert.severity)}`}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold truncate">{alert.device_name}</span>
                      <span className="opacity-60">[{getAlertTypeLabel(alert.type)}]</span>
                    </div>
                    <p className="opacity-80 truncate">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Grid - Top Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SF Distribution Donut Chart */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
              <PieChartIcon className="w-5 h-5 text-blue-500" />
              Distribuție SF Rețea
              <span className={`text-xs font-mono ${textMuted}`}>
                ({sfDistribution.total_uplinks} uplinks)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sfDistribution.distribution.length === 0 ? (
              <div className={`h-64 flex items-center justify-center ${textMuted}`}>
                <p className="text-sm">Nu există date pentru grafic</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={sfDistribution.distribution}
                    dataKey="count"
                    nameKey="sf"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {sfDistribution.distribution.map((entry, index) => (
                      <Cell key={index} fill={SF_COLORS[entry.sf] || SF_COLORS.Unknown} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    formatter={(value, name) => [`${value} uplinks (${sfDistribution.distribution.find(d => d.sf === name)?.percentage || 0}%)`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: theme === "dark" ? "#a1a1aa" : "#64748b" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 10 Problematic Nodes */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
                <TrendingDown className="w-5 h-5 text-red-500" />
                Top 10 Noduri cu Probleme
              </CardTitle>
              <Select value={problemMetric} onValueChange={setProblemMetric}>
                <SelectTrigger className={`w-[160px] h-8 text-xs ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                  <SelectItem value="packet_loss" className={textSecondary}>Pachete Pierdute</SelectItem>
                  <SelectItem value="snr" className={textSecondary}>SNR Scăzut</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {topProblematic.nodes.length === 0 ? (
              <div className={`h-64 flex items-center justify-center ${textMuted}`}>
                <p className="text-sm">Nu există date pentru grafic</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topProblematic.nodes} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 11 }} />
                  <YAxis
                    dataKey="device_name"
                    type="category"
                    tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 10 }}
                    width={80}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    formatter={(value) => [value, topProblematic.nodes[0]?.metric_label || "Valoare"]}
                  />
                  <Bar dataKey="value" fill={problemMetric === "snr" ? "#f59e0b" : "#ef4444"} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RF Quality Evolution */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
                <Activity className="w-5 h-5 text-emerald-500" />
                Evoluție Calitate RF
                <span className={`text-xs font-mono ${textMuted}`}>(7 zile)</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Caută dispozitiv..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className={`w-[140px] h-8 text-xs px-2 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300 placeholder:text-zinc-600" : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-400"}`}
                  />
                </div>
                <Select value={selectedDevice} onValueChange={(val) => { setSelectedDevice(val); setDeviceSearch(""); }}>
                  <SelectTrigger className={`w-[180px] h-8 text-xs ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}>
                    <SelectValue placeholder="Selectează dispozitiv" />
                  </SelectTrigger>
                  <SelectContent className={`max-h-60 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                    {filteredDevices.map(d => (
                      <SelectItem key={d.dev_eui} value={d.dev_eui} className={textSecondary}>
                        {d.name || d.dev_eui}
                      </SelectItem>
                    ))}
                    {filteredDevices.length === 0 && (
                      <div className={`p-2 text-xs ${textMuted}`}>Niciun rezultat</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rfDataFormatted.length === 0 ? (
              <div className={`h-64 flex items-center justify-center ${textMuted}`}>
                <p className="text-sm">Nu există date RF pentru acest dispozitiv</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={rfDataFormatted} margin={{ right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 9 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="rssi"
                    tick={{ fill: "#3b82f6", fontSize: 11 }}
                    orientation="left"
                    label={{ value: "RSSI (dBm)", angle: -90, position: "insideLeft", style: { fill: "#3b82f6", fontSize: 10 } }}
                  />
                  <YAxis
                    yAxisId="snr"
                    tick={{ fill: "#10b981", fontSize: 11 }}
                    orientation="right"
                    label={{ value: "SNR (dB)", angle: 90, position: "insideRight", style: { fill: "#10b981", fontSize: 10 } }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line yAxisId="rssi" type="monotone" dataKey="rssi" stroke="#3b82f6" name="RSSI (dBm)" dot={false} strokeWidth={2} />
                  <Line yAxisId="snr" type="monotone" dataKey="snr" stroke="#10b981" name="SNR (dB)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gateway Load */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
                <Radio className="w-5 h-5 text-purple-500" />
                Încărcare Gateway
                <span className={`text-xs font-mono ${textMuted}`}>(24h)</span>
              </CardTitle>
              <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                <SelectTrigger className={`w-[200px] h-8 text-xs ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}>
                  <SelectValue placeholder="Toate gateway-urile" />
                </SelectTrigger>
                <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                  <SelectItem value="all" className={textSecondary}>Toate Gateway-urile</SelectItem>
                  {(gatewayLoad.gateways || []).map(gw => (
                    <SelectItem key={gw.id || gw.dev_eui} value={gw.dev_eui || gw.id} className={textSecondary}>
                      {gw.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {gatewayLoadFormatted.length === 0 ? (
              <div className={`h-64 flex items-center justify-center ${textMuted}`}>
                <p className="text-sm">Nu există date de trafic pentru gateway</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={gatewayLoadFormatted}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    formatter={(value, name) => {
                      if (name === "count") return [value, "Uplinks"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Ora: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(value) => value === "count" ? "Uplinks/oră" : value} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    fill="url(#colorCount)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Noise / Unregistered Traffic Chart */}
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
              <WifiOff className="w-5 h-5 text-zinc-500" />
              Zgomot de Rețea (Dispozitive Neînregistrate)
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${noiseData.noise_percentage > 20 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                {noiseData.noise_percentage}% zgomot
              </span>
              <span className={`text-xs ${textMuted}`}>
                {noiseData.total_noise_messages} mesaje de la {noiseData.unique_noise_devices} surse necunoscute
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {noiseData.noise_devices.length === 0 ? (
            <div className={`h-48 flex items-center justify-center ${textMuted}`}>
              <p className="text-sm">Nu există trafic de la dispozitive neînregistrate</p>
            </div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={noiseData.noise_devices.slice(0, 15)} margin={{ left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="dev_eui"
                    tick={{ fill: theme === "dark" ? "#71717a" : "#94a3b8", fontSize: 9 }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                    tickFormatter={(v) => v.length > 10 ? v.substring(0, 8) + "..." : v}
                  />
                  <YAxis tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: "8px",
                      fontSize: "12px"
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className={`p-2 rounded border text-xs ${theme === "dark" ? "bg-zinc-900 border-zinc-700 text-zinc-300" : "bg-white border-slate-200 text-slate-700"}`}>
                          <p className="font-mono font-bold">{d.dev_eui}</p>
                          <p>{d.message_count} mesaje</p>
                          <p>RSSI mediu: {d.avg_rssi} dBm</p>
                          <p>SNR mediu: {d.avg_snr} dB</p>
                          <p>SF folosite: {d.sfs_used?.join(", ")}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="message_count" name="Mesaje" radius={[4, 4, 0, 0]}>
                    {noiseData.noise_devices.slice(0, 15).map((_, index) => (
                      <Cell key={index} fill={theme === "dark" ? "#52525b" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
                <div className={`flex items-center gap-2 text-xs ${textMuted}`}>
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  <span>Înregistrate: {noiseData.total_registered_messages}</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${textMuted}`}>
                  <div className={`w-3 h-3 rounded ${theme === "dark" ? "bg-zinc-600" : "bg-slate-400"}`}></div>
                  <span>Zgomot: {noiseData.total_noise_messages}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
