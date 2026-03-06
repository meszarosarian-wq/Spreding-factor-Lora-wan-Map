import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { List, CalendarIcon, X, RefreshCw, Send, Terminal } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getSFBadgeClass = (sf) => {
  if (sf === null || sf === undefined) return "badge-info";
  if (sf <= 8) return "badge-success";
  if (sf <= 10) return "badge-warning";
  return "badge-danger";
};

const getRSSIQuality = (rssi) => {
  if (rssi >= -70) return { label: "Excelent", class: "text-emerald-400" };
  if (rssi >= -90) return { label: "Bun", class: "text-blue-400" };
  if (rssi >= -110) return { label: "Mediu", class: "text-amber-400" };
  return { label: "Slab", class: "text-red-400" };
};

export default function UplinkLogs() {
  const { theme } = useTheme();
  const [uplinks, setUplinks] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-slate-200 text-slate-700";
  const webhookCardClass = theme === "dark" ? "border-amber-600/30 bg-amber-950/10" : "border-amber-200 bg-amber-50";

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedGateway && selectedGateway !== "all") params.append("gateway_id", selectedGateway);
      if (selectedDevice && selectedDevice !== "all") params.append("dev_eui", selectedDevice);
      if (startDate) params.append("start_date", startDate.toISOString());
      if (endDate) params.append("end_date", endDate.toISOString());
      params.append("limit", "100");
      
      const [uplinksRes, gatewaysRes, devicesRes] = await Promise.all([
        axios.get(`${API}/uplinks?${params.toString()}`),
        axios.get(`${API}/gateways`),
        axios.get(`${API}/devices`)
      ]);
      
      setUplinks(uplinksRes.data);
      setGateways(gatewaysRes.data);
      setDevices(devicesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedGateway, selectedDevice, startDate, endDate]);

  const clearFilters = () => {
    setSelectedGateway("all");
    setSelectedDevice("all");
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedGateway !== "all" || selectedDevice !== "all" || startDate || endDate;

  const testWebhook = async () => {
    if (devices.length === 0) { alert("Nu există dispozitive pentru a testa webhook-ul"); return; }
    setTestingWebhook(true);
    try {
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      const randomSF = [7, 8, 9, 10, 11, 12][Math.floor(Math.random() * 6)];
      const gateway = gateways[0];
      
      await axios.post(`${API}/chirpstack/webhook`, {
        devEui: randomDevice.dev_eui,
        txInfo: { dr: 12 - randomSF, frequency: 868100000 },
        rxInfo: [{ gatewayId: gateway?.id || "test-gateway", rssi: -70 - Math.floor(Math.random() * 50), snr: 10 - Math.random() * 15 }]
      });
      fetchData();
    } catch (error) {
      console.error("Webhook test error:", error);
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString('ro-RO');
  };

  return (
    <div className="space-y-4" data-testid="uplink-logs-page">
      {/* Filters Card */}
      <Card className={cardClass}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-amber-500" />
              <span className={`text-sm font-medium ${textSecondary}`}>Filtre:</span>
            </div>
            
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <SelectTrigger className={`w-[180px] ${inputClass}`}><SelectValue placeholder="Gateway" /></SelectTrigger>
              <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                <SelectItem value="all" className={textSecondary}>Toate Gateway-urile</SelectItem>
                {gateways.map((gw) => (<SelectItem key={gw.id} value={gw.id} className={textSecondary}>{gw.name}</SelectItem>))}
              </SelectContent>
            </Select>

            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger className={`w-[180px] ${inputClass}`}><SelectValue placeholder="Dispozitiv" /></SelectTrigger>
              <SelectContent className={theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}>
                <SelectItem value="all" className={textSecondary}>Toate Dispozitivele</SelectItem>
                {devices.map((dev) => (<SelectItem key={dev.dev_eui} value={dev.dev_eui} className={textSecondary}>{dev.name}</SelectItem>))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={inputClass}><CalendarIcon className="w-4 h-4 mr-2" />{startDate ? format(startDate, "dd MMM yyyy", { locale: ro }) : "De la"}</Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto p-0 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={inputClass}><CalendarIcon className="w-4 h-4 mr-2" />{endDate ? format(endDate, "dd MMM yyyy", { locale: ro }) : "Până la"}</Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto p-0 ${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className={textSecondary}><X className="w-4 h-4 mr-1" />Șterge</Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={testWebhook} disabled={testingWebhook} className="border-amber-600/50 text-amber-500 hover:bg-amber-600/20">
                {testingWebhook ? <div className="loading-spinner w-4 h-4 mr-2"></div> : <Send className="w-4 h-4 mr-2" />}Test Webhook
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchData} className={textSecondary}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Reîmprospătare
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card className={`${cardClass} ${webhookCardClass}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-500">Endpoint Webhook ChirpStack</p>
              <code className={`text-xs font-mono px-2 py-1 rounded mt-1 inline-block ${theme === "dark" ? "bg-zinc-950 text-zinc-400" : "bg-slate-100 text-slate-600"}`}>
                POST {process.env.REACT_APP_BACKEND_URL}/api/chirpstack/webhook
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className={`text-lg font-heading font-semibold ${textPrimary} flex items-center gap-2`}>
            <List className="w-5 h-5 text-amber-500" />Istoric Uplink Messages
            <span className={`text-sm font-mono ${textMuted} ml-2`}>({uplinks.length} înregistrări)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="loading-spinner"></div></div>
          ) : uplinks.length === 0 ? (
            <div className="empty-state">
              <List className="empty-state-icon" />
              <p className={textMuted}>Nu există mesaje uplink înregistrate</p>
              <Button variant="outline" onClick={testWebhook} className="mt-4 border-amber-600/50 text-amber-500">
                <Send className="w-4 h-4 mr-2" />Trimite mesaj de test
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={theme === "dark" ? "border-zinc-800" : "border-slate-200"}>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Timestamp</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Dispozitiv</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>DevEUI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Gateway</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>SF</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>RSSI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>SNR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uplinks.map((uplink) => {
                    const rssiQuality = getRSSIQuality(uplink.rssi);
                    return (
                      <TableRow key={uplink.id} className={theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}>
                        <TableCell className={`font-mono text-xs ${textSecondary}`}>{formatTimestamp(uplink.timestamp)}</TableCell>
                        <TableCell className={textPrimary}>{uplink.device_name || "—"}</TableCell>
                        <TableCell className={`font-mono text-xs ${textSecondary}`}>{uplink.dev_eui}</TableCell>
                        <TableCell className={`text-sm ${textSecondary}`}>{uplink.gateway_name || uplink.gateway_id || "—"}</TableCell>
                        <TableCell><span className={`badge ${getSFBadgeClass(uplink.spreading_factor)}`}>SF{uplink.spreading_factor}</span></TableCell>
                        <TableCell><span className={`font-mono text-sm ${rssiQuality.class}`}>{uplink.rssi} dBm</span></TableCell>
                        <TableCell className={`font-mono text-sm ${textSecondary}`}>{uplink.snr.toFixed(1)} dB</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
