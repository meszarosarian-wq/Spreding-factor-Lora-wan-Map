import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Radio, Zap, Clock, Signal, Activity, 
  Pause, Play, Trash2, Eye, Send, Terminal,
  Wifi, WifiOff
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
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const previousIdsRef = useRef(new Set());
  const intervalRef = useRef(null);

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const liveCardClass = theme === "dark" 
    ? "border-emerald-600/30 bg-emerald-950/10" 
    : "border-emerald-200 bg-emerald-50";
  const pausedCardClass = theme === "dark"
    ? "border-amber-600/30 bg-amber-950/10"
    : "border-amber-200 bg-amber-50";

  const fetchData = useCallback(async () => {
    try {
      const [uplinksRes, devicesRes, gatewaysRes] = await Promise.all([
        axios.get(`${API}/uplinks?limit=50`),
        axios.get(`${API}/devices`),
        axios.get(`${API}/gateways`)
      ]);
      
      const newUplinks = uplinksRes.data;
      
      // Check for new entries
      const currentIds = new Set(newUplinks.map(u => u.id));
      const newEntries = newUplinks.filter(u => !previousIdsRef.current.has(u.id));
      
      if (newEntries.length > 0 && previousIdsRef.current.size > 0) {
        setNewCount(prev => prev + newEntries.length);
        // Show toast for new uplinks
        newEntries.forEach(entry => {
          toast.success(`Uplink nou: ${entry.device_name || entry.dev_eui}`, {
            description: `SF${entry.spreading_factor} | RSSI: ${entry.rssi} dBm`,
            duration: 3000
          });
        });
      }
      
      previousIdsRef.current = currentIds;
      setUplinks(newUplinks);
      setDevices(devicesRes.data);
      setGateways(gatewaysRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when live
  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(fetchData, 3000); // Refresh every 3 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isLive, fetchData]);

  const toggleLive = () => {
    setIsLive(!isLive);
    if (!isLive) {
      setNewCount(0);
    }
  };

  const clearNewCount = () => {
    setNewCount(0);
  };

  const viewDetails = (uplink) => {
    setSelectedLog(uplink);
    setDetailsOpen(true);
  };

  const testWebhook = async () => {
    if (devices.length === 0) {
      toast.error("Nu există dispozitive pentru a testa webhook-ul");
      return;
    }

    setTestingWebhook(true);
    
    try {
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      const randomSF = [7, 8, 9, 10, 11, 12][Math.floor(Math.random() * 6)];
      const gateway = gateways[0];
      
      const testPayload = {
        devEui: randomDevice.dev_eui,
        txInfo: {
          dr: 12 - randomSF,
          frequency: 868100000
        },
        rxInfo: [{
          gatewayId: gateway?.id || "test-gateway",
          rssi: -70 - Math.floor(Math.random() * 50),
          snr: 10 - Math.random() * 15
        }]
      };

      await axios.post(`${API}/chirpstack/webhook`, testPayload);
      
      // Immediate refresh
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error("Webhook test error:", error);
      toast.error("Eroare la trimiterea webhook-ului de test");
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 5) return "acum";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
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
                    <p className={`text-xs ${textMuted}`}>
                      Auto-refresh la 3s • Actualizat {formatTimeAgo(lastUpdate)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <WifiOff className="w-6 h-6 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-500">PAUZĂ</p>
                    <p className={`text-xs ${textMuted}`}>Feed-ul live este oprit</p>
                  </div>
                </div>
              )}
              
              {newCount > 0 && (
                <Badge 
                  className="bg-emerald-600 text-white cursor-pointer hover:bg-emerald-500"
                  onClick={clearNewCount}
                >
                  +{newCount} noi
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Test Webhook */}
              <Button 
                variant="outline"
                size="sm"
                onClick={testWebhook}
                disabled={testingWebhook}
                className={theme === "dark" ? "border-blue-600/50 text-blue-400 hover:bg-blue-600/20" : "border-blue-300 text-blue-600 hover:bg-blue-50"}
                data-testid="test-webhook-btn"
              >
                {testingWebhook ? (
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Simulează Uplink
              </Button>

              {/* Live Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="live-mode"
                  checked={isLive}
                  onCheckedChange={toggleLive}
                  data-testid="live-toggle"
                />
                <Label htmlFor="live-mode" className={`text-sm cursor-pointer ${textSecondary}`}>
                  {isLive ? (
                    <span className="flex items-center gap-1">
                      <Pause className="w-4 h-4" /> Pauză
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Play className="w-4 h-4" /> Pornește
                    </span>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card className={`${cardClass} ${theme === "dark" ? "border-zinc-700" : "border-slate-200"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${textPrimary}`}>Endpoint Webhook ChirpStack</p>
              <code className={`text-xs font-mono px-2 py-1 rounded mt-1 inline-block ${theme === "dark" ? "bg-zinc-950 text-zinc-400" : "bg-slate-100 text-slate-600"}`}>
                POST {process.env.REACT_APP_BACKEND_URL}/api/chirpstack/webhook
              </code>
              <p className={`text-xs mt-2 ${textMuted}`}>
                Configurați acest URL în ChirpStack → Applications → Integrations → HTTP
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Feed Table */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className={`text-lg font-heading font-semibold ${textPrimary} flex items-center gap-2`}>
            <Zap className="w-5 h-5 text-amber-500" />
            Feed Live ChirpStack
            <span className={`text-sm font-mono ${textMuted} ml-2`}>
              ({uplinks.length} mesaje)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uplinks.length === 0 ? (
            <div className="empty-state py-12">
              <Radio className="w-12 h-12 mb-4 opacity-30" />
              <p className={textMuted}>Așteptăm mesaje de la ChirpStack...</p>
              <p className={`text-xs mt-2 ${textMuted}`}>
                Mesajele vor apărea aici în timp real când dispozitivele trimit date
              </p>
              <Button 
                variant="outline"
                onClick={testWebhook}
                className="mt-4"
              >
                <Send className="w-4 h-4 mr-2" />
                Trimite mesaj de test
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={theme === "dark" ? "border-zinc-800" : "border-slate-200"}>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} w-12`}></TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Timp</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Dispozitiv</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>DevEUI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Gateway</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>SF</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>RSSI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>SNR</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} text-right`}>Detalii</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uplinks.map((uplink, index) => {
                    const isNew = index < newCount;
                    return (
                      <TableRow 
                        key={uplink.id} 
                        className={`
                          ${theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}
                          ${isNew ? (theme === "dark" ? "bg-emerald-950/20" : "bg-emerald-50") : ""}
                          transition-colors duration-300
                        `}
                        data-testid={`live-row-${uplink.id}`}
                      >
                        <TableCell>
                          <Activity 
                            className="w-4 h-4" 
                            style={{ color: getSFColor(uplink.spreading_factor) }}
                          />
                        </TableCell>
                        <TableCell className={`font-mono text-xs ${textSecondary}`}>
                          {formatTimestamp(uplink.timestamp)}
                        </TableCell>
                        <TableCell className={`font-medium ${textPrimary}`}>
                          {uplink.device_name || "—"}
                        </TableCell>
                        <TableCell className={`font-mono text-xs ${textMuted}`}>
                          {uplink.dev_eui.substring(0, 8)}...
                        </TableCell>
                        <TableCell className={`text-sm ${textSecondary}`}>
                          {uplink.gateway_name || "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${getSFBadgeClass(uplink.spreading_factor)}`}>
                            SF{uplink.spreading_factor}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span 
                            className="font-mono text-sm"
                            style={{ color: uplink.rssi >= -90 ? "#10b981" : uplink.rssi >= -110 ? "#f59e0b" : "#ef4444" }}
                          >
                            {uplink.rssi} dBm
                          </span>
                        </TableCell>
                        <TableCell className={`font-mono text-sm ${textSecondary}`}>
                          {uplink.snr.toFixed(1)} dB
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(uplink)}
                            className={textSecondary}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
        <DialogContent className={`${theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200"} max-w-lg`}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary} flex items-center gap-2`}>
              <Signal className="w-5 h-5 text-blue-500" />
              Detalii Uplink
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              Informații complete despre mesajul primit
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4 py-4">
              {/* Device Info */}
              <div className={`p-3 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                <p className={`text-xs font-mono uppercase ${textMuted} mb-2`}>Dispozitiv</p>
                <p className={`font-semibold ${textPrimary}`}>{selectedLog.device_name || "Necunoscut"}</p>
                <p className={`text-xs font-mono ${textMuted}`}>{selectedLog.dev_eui}</p>
              </div>

              {/* Signal Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>SF</p>
                  <p 
                    className="text-2xl font-bold font-mono"
                    style={{ color: getSFColor(selectedLog.spreading_factor) }}
                  >
                    {selectedLog.spreading_factor}
                  </p>
                </div>
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>RSSI</p>
                  <p className={`text-2xl font-bold font-mono ${textPrimary}`}>
                    {selectedLog.rssi}
                  </p>
                  <p className={`text-xs ${textMuted}`}>dBm</p>
                </div>
                <div className={`p-3 rounded border text-center ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-mono uppercase ${textMuted} mb-1`}>SNR</p>
                  <p className={`text-2xl font-bold font-mono ${textPrimary}`}>
                    {selectedLog.snr.toFixed(1)}
                  </p>
                  <p className={`text-xs ${textMuted}`}>dB</p>
                </div>
              </div>

              {/* Gateway & Time */}
              <div className={`p-3 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-mono uppercase ${textMuted}`}>Gateway</span>
                  <span className={textSecondary}>{selectedLog.gateway_name || selectedLog.gateway_id || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-mono uppercase ${textMuted}`}>Timestamp</span>
                  <span className={`font-mono text-sm ${textSecondary}`}>
                    {new Date(selectedLog.timestamp).toLocaleString('ro-RO')}
                  </span>
                </div>
              </div>

              {/* Raw Data */}
              <div>
                <p className={`text-xs font-mono uppercase ${textMuted} mb-2`}>Date Raw (JSON)</p>
                <pre className={`p-3 rounded text-xs font-mono overflow-x-auto ${theme === "dark" ? "bg-zinc-950 text-zinc-400" : "bg-slate-100 text-slate-600"}`}>
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
