import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Radio, Zap, Signal, Activity, 
  Pause, Play, Eye, Send, Terminal,
  Wifi, WifiOff, AlertTriangle, Plus, Check,
  Search, ArrowUpDown, ArrowUp, ArrowDown, X,
  Download, FileSpreadsheet
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getSFColor = (sf) => {
  if (sf === null || sf === undefined) return "#71717a";
  if (sf <= 8) return "#10b981";
  if (sf <= 10) return "#f59e0b";
  return "#ef4444";
};

const getSFBadgeClass = (sf) => {
  if (sf === null || sf === undefined) return "badge-info";
  if (sf <= 8) return "badge-success";
  if (sf <= 10) return "badge-warning";
  return "badge-danger";
};

export default function LiveFeed() {
  const { theme } = useTheme();
  const [uplinks, setUplinks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [unregisteredDevices, setUnregisteredDevices] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerData, setRegisterData] = useState({ dev_eui: "", name: "", latitude: "", longitude: "" });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const previousIdsRef = useRef(new Set());
  const intervalRef = useRef(null);

  // Search and Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  const [filterRegistered, setFilterRegistered] = useState("all");

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-slate-200 text-slate-900";
  const dialogClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";
  const liveCardClass = theme === "dark" ? "border-emerald-600/30 bg-emerald-950/10" : "border-emerald-200 bg-emerald-50";
  const pausedCardClass = theme === "dark" ? "border-amber-600/30 bg-amber-950/10" : "border-amber-200 bg-amber-50";
  const warningCardClass = theme === "dark" ? "border-red-600/30 bg-red-950/10" : "border-red-200 bg-red-50";

  const fetchData = useCallback(async () => {
    try {
      const [uplinksRes, devicesRes, gatewaysRes, unregRes] = await Promise.all([
        axios.get(`${API}/uplinks?limit=100`),
        axios.get(`${API}/devices`),
        axios.get(`${API}/gateways`),
        axios.get(`${API}/unregistered-devices`)
      ]);
      
      const newUplinks = uplinksRes.data;
      const currentIds = new Set(newUplinks.map(u => u.id));
      const newEntries = newUplinks.filter(u => !previousIdsRef.current.has(u.id));
      
      if (newEntries.length > 0 && previousIdsRef.current.size > 0) {
        setNewCount(prev => prev + newEntries.length);
        newEntries.forEach(entry => {
          const isRegistered = entry.device_registered;
          toast[isRegistered ? 'success' : 'warning'](
            `${isRegistered ? 'Uplink' : 'DevEUI necunoscut'}: ${entry.device_name || entry.dev_eui.substring(0, 12)}...`, 
            { description: `SF${entry.spreading_factor} | RSSI: ${entry.rssi} dBm`, duration: 3000 }
          );
        });
      }
      
      previousIdsRef.current = currentIds;
      setUplinks(newUplinks);
      setDevices(devicesRes.data);
      setGateways(gatewaysRes.data);
      setUnregisteredDevices(unregRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLive, fetchData]);

  // Filtered and sorted data
  const filteredUplinks = useMemo(() => {
    let result = [...uplinks];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(u => 
        (u.device_name || "").toLowerCase().includes(term) ||
        u.dev_eui.toLowerCase().includes(term) ||
        (u.gateway_name || "").toLowerCase().includes(term)
      );
    }
    
    // Filter by registration status
    if (filterRegistered === "registered") {
      result = result.filter(u => u.device_registered);
    } else if (filterRegistered === "unregistered") {
      result = result.filter(u => !u.device_registered);
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case "timestamp":
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case "name":
          aVal = (a.device_name || a.dev_eui).toLowerCase();
          bVal = (b.device_name || b.dev_eui).toLowerCase();
          break;
        case "sf":
          aVal = a.spreading_factor;
          bVal = b.spreading_factor;
          break;
        case "rssi":
          aVal = a.rssi;
          bVal = b.rssi;
          break;
        case "snr":
          aVal = a.snr;
          bVal = b.snr;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [uplinks, searchTerm, filterRegistered, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const toggleLive = () => {
    setIsLive(!isLive);
    if (!isLive) setNewCount(0);
  };

  const viewDetails = (uplink) => {
    setSelectedLog(uplink);
    setDetailsOpen(true);
  };

  const openRegisterDialog = (devEui) => {
    setRegisterData({ dev_eui: devEui, name: "", latitude: "44.4268", longitude: "26.1025" });
    setRegisterOpen(true);
  };

  const handleQuickRegister = async () => {
    try {
      await axios.post(`${API}/devices/quick-register`, null, {
        params: {
          dev_eui: registerData.dev_eui,
          name: registerData.name || `Device ${registerData.dev_eui.substring(0, 8)}`,
          latitude: parseFloat(registerData.latitude) || 0,
          longitude: parseFloat(registerData.longitude) || 0
        }
      });
      toast.success("Dispozitiv înregistrat cu succes!");
      setRegisterOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare la înregistrare");
    }
  };

  const testWebhook = async () => {
    if (devices.length === 0) { toast.error("Nu există dispozitive pentru test"); return; }
    setTestingWebhook(true);
    try {
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      const randomSF = [7, 8, 9, 10, 11, 12][Math.floor(Math.random() * 6)];
      const gateway = gateways[0];
      await axios.post(`${API}/chirpstack/webhook`, {
        devEui: randomDevice.dev_eui,
        deviceName: randomDevice.name,
        txInfo: { dr: 12 - randomSF, frequency: 868100000 },
        rxInfo: [{ gatewayId: gateway?.id || "test-gateway", rssi: -70 - Math.floor(Math.random() * 50), snr: 10 - Math.random() * 15 }]
      });
      setTimeout(fetchData, 500);
    } catch (error) {
      toast.error("Eroare webhook test");
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString('ro-RO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit'
    });
  };

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 5) return "acum";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterRegistered("all");
    setSortField("timestamp");
    setSortDirection("desc");
  };

  const hasActiveFilters = searchTerm || filterRegistered !== "all" || sortField !== "timestamp";

  // Export to CSV function
  const exportToCSV = () => {
    if (filteredUplinks.length === 0) {
      toast.error("Nu există date pentru export");
      return;
    }
    
    const headers = ["Timestamp", "DevEUI", "Device Name", "Registered", "Gateway", "SF", "RSSI (dBm)", "SNR (dB)"];
    const rows = filteredUplinks.map(u => [
      new Date(u.timestamp).toISOString(),
      u.dev_eui,
      u.device_name || "",
      u.device_registered ? "Da" : "Nu",
      u.gateway_name || u.gateway_id || "",
      u.spreading_factor,
      u.rssi,
      u.snr.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uplink_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`${filteredUplinks.length} înregistrări exportate`);
  };

  return (
    <div className="space-y-4" data-testid="live-feed-page">
      {/* Status Card */}
      <Card className={`${cardClass} ${isLive ? liveCardClass : pausedCardClass}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Wifi className="w-6 h-6 text-emerald-500" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-500">LIVE</p>
                    <p className={`text-xs ${textMuted}`}>Auto-refresh 3s • {formatTimeAgo(lastUpdate)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <WifiOff className="w-6 h-6 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-500">PAUZĂ</p>
                    <p className={`text-xs ${textMuted}`}>Feed oprit</p>
                  </div>
                </div>
              )}
              {newCount > 0 && (
                <Badge className="bg-emerald-600 text-white cursor-pointer" onClick={() => setNewCount(0)}>+{newCount} noi</Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={testWebhook} disabled={testingWebhook}
                className={theme === "dark" ? "border-blue-600/50 text-blue-400" : "border-blue-300 text-blue-600"}>
                {testingWebhook ? <div className="loading-spinner w-4 h-4 mr-2"></div> : <Send className="w-4 h-4 mr-2" />}
                Simulează
              </Button>
              <div className="flex items-center gap-2">
                <Switch id="live-mode" checked={isLive} onCheckedChange={toggleLive} />
                <Label htmlFor="live-mode" className={`text-sm cursor-pointer ${textSecondary}`}>
                  {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className={cardClass}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textMuted}`} />
              <Input
                placeholder="Caută după nume, DevEUI, gateway..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${inputClass}`}
              />
            </div>
            
            <Select value={filterRegistered} onValueChange={setFilterRegistered}>
              <SelectTrigger className={`w-[180px] ${inputClass}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className={dialogClass}>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="registered">Înregistrate</SelectItem>
                <SelectItem value="unregistered">Neînregistrate</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className={textSecondary}>
                <X className="w-4 h-4 mr-1" />Resetează
              </Button>
            )}

            <span className={`text-sm ${textMuted} ml-auto`}>
              {filteredUplinks.length} din {uplinks.length}
            </span>
            
            <Button variant="outline" size="sm" onClick={exportToCSV} 
              className={theme === "dark" ? "border-zinc-700 text-zinc-300" : ""}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Feed Table */}
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-lg font-heading font-semibold ${textPrimary} flex items-center gap-2`}>
            <Zap className="w-5 h-5 text-amber-500" />Feed Live ChirpStack
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUplinks.length === 0 ? (
            <div className="empty-state py-12">
              <Radio className="w-12 h-12 mb-4 opacity-30" />
              <p className={textMuted}>{searchTerm ? "Nu s-au găsit rezultate" : "Așteptăm mesaje..."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={theme === "dark" ? "border-zinc-800" : "border-slate-200"}>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} w-12`}>Status</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("timestamp")}>
                      <span className="flex items-center">Timp<SortIcon field="timestamp" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("name")}>
                      <span className="flex items-center">Nume<SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>DevEUI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Gateway</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("sf")}>
                      <span className="flex items-center">SF<SortIcon field="sf" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("rssi")}>
                      <span className="flex items-center">RSSI<SortIcon field="rssi" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("snr")}>
                      <span className="flex items-center">SNR<SortIcon field="snr" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} text-right`}>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUplinks.map((uplink, index) => {
                    const isNew = index < newCount;
                    const isRegistered = uplink.device_registered;
                    return (
                      <TableRow key={uplink.id} className={`
                        ${theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}
                        ${isNew ? (theme === "dark" ? "bg-emerald-950/20" : "bg-emerald-50") : ""}
                        ${!isRegistered ? (theme === "dark" ? "bg-red-950/10" : "bg-red-50/50") : ""}
                      `}>
                        <TableCell>
                          {isRegistered ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </TableCell>
                        <TableCell className={`font-mono text-xs ${textSecondary}`}>{formatTimestamp(uplink.timestamp)}</TableCell>
                        <TableCell className={`font-medium ${isRegistered ? textPrimary : "text-red-500"}`}>
                          {uplink.device_name || <span className="italic">Neînregistrat</span>}
                        </TableCell>
                        <TableCell className={`font-mono text-xs ${textMuted}`}>{uplink.dev_eui.substring(0, 12)}...</TableCell>
                        <TableCell className={`text-sm ${uplink.gateway_registered ? textSecondary : "text-amber-500"}`}>
                          {uplink.gateway_name || uplink.gateway_id?.substring(0, 12) || "—"}
                        </TableCell>
                        <TableCell><span className={`badge ${getSFBadgeClass(uplink.spreading_factor)}`}>SF{uplink.spreading_factor}</span></TableCell>
                        <TableCell>
                          <span className="font-mono text-sm" style={{ color: uplink.rssi >= -90 ? "#10b981" : uplink.rssi >= -110 ? "#f59e0b" : "#ef4444" }}>
                            {uplink.rssi} dBm
                          </span>
                        </TableCell>
                        <TableCell className={`font-mono text-sm ${textSecondary}`}>{uplink.snr.toFixed(1)} dB</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!isRegistered && (
                              <Button variant="ghost" size="sm" onClick={() => openRegisterDialog(uplink.dev_eui)} className="text-blue-500 h-7 px-2">
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => viewDetails(uplink)} className={textSecondary}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className={`${dialogClass} max-w-lg`}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary} flex items-center gap-2`}>
              <Signal className="w-5 h-5 text-blue-500" />Detalii Uplink
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className={`p-3 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-mono uppercase ${textMuted}`}>Dispozitiv</p>
                  <Badge className={selectedLog.device_registered ? "bg-emerald-600" : "bg-red-600"}>{selectedLog.device_registered ? "Înregistrat" : "Neînregistrat"}</Badge>
                </div>
                <p className={`font-semibold ${textPrimary}`}>{selectedLog.device_name || "Necunoscut"}</p>
                <p className={`text-xs font-mono ${textMuted}`}>{selectedLog.dev_eui}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>SF</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: getSFColor(selectedLog.spreading_factor) }}>{selectedLog.spreading_factor}</p>
                </div>
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>RSSI</p>
                  <p className={`text-2xl font-bold font-mono ${textPrimary}`}>{selectedLog.rssi}</p>
                  <p className={`text-xs ${textMuted}`}>dBm</p>
                </div>
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>SNR</p>
                  <p className={`text-2xl font-bold font-mono ${textPrimary}`}>{selectedLog.snr.toFixed(1)}</p>
                  <p className={`text-xs ${textMuted}`}>dB</p>
                </div>
              </div>
              <pre className={`p-3 rounded text-xs font-mono overflow-x-auto max-h-48 ${theme === "dark" ? "bg-zinc-950 text-zinc-400" : "bg-slate-100 text-slate-600"}`}>
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}>Înregistrare Rapidă</DialogTitle>
            <DialogDescription className={textSecondary}>Adăugați dispozitivul pentru a-l vedea pe hartă</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className={textSecondary}>DevEUI</Label>
              <Input value={registerData.dev_eui} disabled className={`${inputClass} font-mono`} />
            </div>
            <div className="space-y-2">
              <Label className={textSecondary}>Nume Dispozitiv</Label>
              <Input value={registerData.name} onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                placeholder={`Device ${registerData.dev_eui.substring(0, 8)}`} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={textSecondary}>Latitudine</Label>
                <Input type="number" step="any" value={registerData.latitude} onChange={(e) => setRegisterData({ ...registerData, latitude: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              <div className="space-y-2">
                <Label className={textSecondary}>Longitudine</Label>
                <Input type="number" step="any" value={registerData.longitude} onChange={(e) => setRegisterData({ ...registerData, longitude: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Anulează</Button>
            <Button onClick={handleQuickRegister} className="bg-blue-600 hover:bg-blue-500 text-white">
              <Check className="w-4 h-4 mr-2" />Înregistrează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
