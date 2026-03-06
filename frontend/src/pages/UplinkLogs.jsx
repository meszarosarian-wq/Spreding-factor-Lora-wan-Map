import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { List, CalendarIcon, X, RefreshCw, Send, Terminal } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Get SF badge class
const getSFBadgeClass = (sf) => {
  if (sf === null || sf === undefined) return "badge-info";
  if (sf <= 8) return "badge-success";
  if (sf <= 10) return "badge-warning";
  return "badge-danger";
};

// Get RSSI quality
const getRSSIQuality = (rssi) => {
  if (rssi >= -70) return { label: "Excelent", class: "text-emerald-400" };
  if (rssi >= -90) return { label: "Bun", class: "text-blue-400" };
  if (rssi >= -110) return { label: "Mediu", class: "text-amber-400" };
  return { label: "Slab", class: "text-red-400" };
};

export default function UplinkLogs() {
  const [uplinks, setUplinks] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedGateway, setSelectedGateway] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Webhook test
  const [testingWebhook, setTestingWebhook] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedGateway && selectedGateway !== "all") {
        params.append("gateway_id", selectedGateway);
      }
      if (selectedDevice && selectedDevice !== "all") {
        params.append("dev_eui", selectedDevice);
      }
      if (startDate) {
        params.append("start_date", startDate.toISOString());
      }
      if (endDate) {
        params.append("end_date", endDate.toISOString());
      }
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

  useEffect(() => {
    fetchData();
  }, [selectedGateway, selectedDevice, startDate, endDate]);

  const clearFilters = () => {
    setSelectedGateway("all");
    setSelectedDevice("all");
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = selectedGateway !== "all" || selectedDevice !== "all" || startDate || endDate;

  // Test webhook with sample data
  const testWebhook = async () => {
    if (devices.length === 0) {
      alert("Nu există dispozitive pentru a testa webhook-ul");
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
          dr: 12 - randomSF, // Convert SF to DataRate
          frequency: 868100000
        },
        rxInfo: [
          {
            gatewayId: gateway?.id || "test-gateway",
            rssi: -70 - Math.floor(Math.random() * 50),
            snr: 10 - Math.random() * 15
          }
        ]
      };

      await axios.post(`${API}/chirpstack/webhook`, testPayload);
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Webhook test error:", error);
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-4" data-testid="uplink-logs-page">
      {/* Filters Card */}
      <Card className="card-base">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-zinc-300">Filtre:</span>
            </div>
            
            {/* Gateway Filter */}
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <SelectTrigger 
                className="w-[180px] bg-zinc-950 border-zinc-800 text-zinc-300"
                data-testid="filter-gateway"
              >
                <SelectValue placeholder="Gateway" />
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

            {/* Device Filter */}
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger 
                className="w-[180px] bg-zinc-950 border-zinc-800 text-zinc-300"
                data-testid="filter-device"
              >
                <SelectValue placeholder="Dispozitiv" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all" className="text-zinc-300">Toate Dispozitivele</SelectItem>
                {devices.map((dev) => (
                  <SelectItem key={dev.dev_eui} value={dev.dev_eui} className="text-zinc-300">
                    {dev.name}
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
                  {startDate ? format(startDate, "dd MMM yyyy", { locale: ro }) : "De la"}
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
                  {endDate ? format(endDate, "dd MMM yyyy", { locale: ro }) : "Până la"}
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
                Șterge
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Test Webhook Button */}
              <Button 
                variant="outline"
                size="sm"
                onClick={testWebhook}
                disabled={testingWebhook}
                className="border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
                data-testid="test-webhook-btn"
              >
                {testingWebhook ? (
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Test Webhook
              </Button>

              {/* Refresh */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={fetchData}
                className="text-zinc-400 hover:text-white"
                data-testid="refresh-logs"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Reîmprospătare
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info Card */}
      <Card className="card-base border-amber-600/30 bg-amber-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">Endpoint Webhook ChirpStack</p>
              <code className="text-xs text-zinc-400 font-mono bg-zinc-950 px-2 py-1 rounded mt-1 inline-block">
                POST {process.env.REACT_APP_BACKEND_URL}/api/chirpstack/webhook
              </code>
              <p className="text-xs text-zinc-500 mt-2">
                Configurați acest URL în ChirpStack Application Server pentru a primi evenimente UplinkEvent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-lg font-heading font-semibold text-zinc-100 flex items-center gap-2">
            <List className="w-5 h-5 text-amber-500" />
            Istoric Uplink Messages
            <span className="text-sm font-mono text-zinc-500 ml-2">
              ({uplinks.length} înregistrări)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading-spinner"></div>
            </div>
          ) : uplinks.length === 0 ? (
            <div className="empty-state">
              <List className="empty-state-icon" />
              <p className="text-zinc-500">Nu există mesaje uplink înregistrate</p>
              <p className="text-xs text-zinc-600 mt-2">
                Mesajele vor apărea aici când dispozitivele trimit date prin ChirpStack
              </p>
              <Button 
                variant="outline"
                onClick={testWebhook}
                className="mt-4 border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
              >
                <Send className="w-4 h-4 mr-2" />
                Trimite mesaj de test
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="uplinks-table">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Timestamp</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Dispozitiv</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">DevEUI</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Gateway</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">SF</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">RSSI</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">SNR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uplinks.map((uplink) => {
                    const rssiQuality = getRSSIQuality(uplink.rssi);
                    return (
                      <TableRow 
                        key={uplink.id} 
                        className="border-zinc-800/50 hover:bg-zinc-900/50"
                        data-testid={`uplink-row-${uplink.id}`}
                      >
                        <TableCell className="font-mono text-xs text-zinc-400">
                          {formatTimestamp(uplink.timestamp)}
                        </TableCell>
                        <TableCell className="text-zinc-200">
                          {uplink.device_name || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-400">
                          {uplink.dev_eui}
                        </TableCell>
                        <TableCell className="text-zinc-300 text-sm">
                          {uplink.gateway_name || uplink.gateway_id || "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${getSFBadgeClass(uplink.spreading_factor)}`}>
                            SF{uplink.spreading_factor}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-sm ${rssiQuality.class}`}>
                            {uplink.rssi} dBm
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-300">
                          {uplink.snr.toFixed(1)} dB
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
    </div>
  );
}
