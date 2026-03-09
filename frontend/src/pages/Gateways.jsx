import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Router, MapPin, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Download, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Gateways() {
  const { theme } = useTheme();
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [formData, setFormData] = useState({ dev_eui: "", name: "", latitude: "", longitude: "", status: "active" });

  // Search and Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("all");

  // Frequency distribution state
  const [freqGatewayId, setFreqGatewayId] = useState("");
  const [freqData, setFreqData] = useState({ frequencies: [], total_messages: 0 });
  const [freqLoading, setFreqLoading] = useState(false);

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-slate-200 text-slate-900";
  const dialogClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/gateways`);
      setGateways(response.data);
    } catch (error) {
      toast.error("Eroare la încărcarea gateway-urilor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGateways(); }, []);

  // Fetch frequency distribution when gateway is selected
  useEffect(() => {
    const fetchFrequencies = async () => {
      if (!freqGatewayId) return;
      setFreqLoading(true);
      try {
        const res = await axios.get(`${API}/stats/frequencies?gateway_id=${freqGatewayId}`);
        setFreqData(res.data);
      } catch (e) {
        console.error("Error fetching frequencies:", e);
      } finally {
        setFreqLoading(false);
      }
    };
    fetchFrequencies();
  }, [freqGatewayId]);

  // Auto-select first gateway for frequency chart
  useEffect(() => {
    if (gateways.length > 0 && !freqGatewayId) {
      setFreqGatewayId(gateways[0].dev_eui || gateways[0].id);
    }
  }, [gateways, freqGatewayId]);

  // Filtered and sorted data
  const filteredGateways = useMemo(() => {
    let result = [...gateways];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.name.toLowerCase().includes(term) ||
        (g.dev_eui || "").toLowerCase().includes(term) ||
        g.id.toLowerCase().includes(term)
      );
    }
    
    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter(g => g.status === filterStatus);
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "dev_eui":
          aVal = (a.dev_eui || "").toLowerCase();
          bVal = (b.dev_eui || "").toLowerCase();
          break;
        case "latitude":
          aVal = a.latitude;
          bVal = b.latitude;
          break;
        case "longitude":
          aVal = a.longitude;
          bVal = b.longitude;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [gateways, searchTerm, filterStatus, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSortField("name");
    setSortDirection("asc");
  };

  const hasActiveFilters = searchTerm || filterStatus !== "all" || sortField !== "name";

  // Export gateways to CSV
  const exportGatewaysToCSV = () => {
    if (filteredGateways.length === 0) {
      toast.error("Nu există date pentru export");
      return;
    }
    
    const headers = ["ID", "DevEUI", "Nume", "Latitudine", "Longitudine", "Status"];
    const rows = filteredGateways.map(g => [
      g.id,
      g.dev_eui || "",
      g.name,
      g.latitude,
      g.longitude,
      g.status
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gateways_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`${filteredGateways.length} gateway-uri exportate`);
  };

  const handleOpenDialog = (gateway = null) => {
    if (gateway) {
      setSelectedGateway(gateway);
      setFormData({ dev_eui: gateway.dev_eui || "", name: gateway.name, latitude: gateway.latitude.toString(), longitude: gateway.longitude.toString(), status: gateway.status });
    } else {
      setSelectedGateway(null);
      setFormData({ dev_eui: "", name: "", latitude: "", longitude: "", status: "active" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = { dev_eui: formData.dev_eui || null, name: formData.name, latitude: parseFloat(formData.latitude), longitude: parseFloat(formData.longitude), status: formData.status };
      if (selectedGateway) {
        await axios.put(`${API}/gateways/${selectedGateway.id}`, payload);
        toast.success("Gateway actualizat");
      } else {
        await axios.post(`${API}/gateways`, payload);
        toast.success("Gateway adăugat");
      }
      setDialogOpen(false);
      fetchGateways();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/gateways/${selectedGateway.id}`);
      toast.success("Gateway șters");
      setDeleteDialogOpen(false);
      setSelectedGateway(null);
      fetchGateways();
    } catch (error) {
      toast.error("Eroare la ștergere");
    }
  };

  return (
    <div className="space-y-4" data-testid="gateways-page">
      {/* Search and Filters */}
      <Card className={cardClass}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textMuted}`} />
              <Input
                placeholder="Caută după nume, DevEUI sau ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${inputClass}`}
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={`w-[150px] ${inputClass}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className={dialogClass}>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="active">🟢 Active</SelectItem>
                <SelectItem value="inactive">🔴 Inactive</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className={textSecondary}>
                <X className="w-4 h-4 mr-1" />Resetează
              </Button>
            )}

            <span className={`text-sm ${textMuted}`}>{filteredGateways.length} din {gateways.length}</span>

            <Button variant="outline" size="sm" onClick={exportGatewaysToCSV} 
              className={theme === "dark" ? "border-emerald-700 text-emerald-400" : "border-emerald-300 text-emerald-600"}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />Export
            </Button>

            <Button onClick={() => handleOpenDialog()} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="w-4 h-4 mr-2" />Adaugă Gateway
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gateways Table */}
      <Card className={cardClass}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Router className="w-6 h-6 text-blue-500" />
            <CardTitle className={`text-xl font-heading font-semibold ${textPrimary}`}>Gateway-uri LoRaWAN</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="loading-spinner"></div></div>
          ) : filteredGateways.length === 0 ? (
            <div className="empty-state">
              <Router className="empty-state-icon" />
              <p className={textMuted}>{searchTerm ? "Nu s-au găsit rezultate" : "Nu există gateway-uri"}</p>
              <Button onClick={() => handleOpenDialog()} className="mt-4 bg-blue-600 hover:bg-blue-500">Adaugă</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={theme === "dark" ? "border-zinc-800" : "border-slate-200"}>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("name")}>
                      <span className="flex items-center">Nume<SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("dev_eui")}>
                      <span className="flex items-center">DevEUI<SortIcon field="dev_eui" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>ID Intern</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("latitude")}>
                      <span className="flex items-center">Lat<SortIcon field="latitude" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("longitude")}>
                      <span className="flex items-center">Lng<SortIcon field="longitude" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("status")}>
                      <span className="flex items-center">Status<SortIcon field="status" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} text-right`}>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGateways.map((gateway) => (
                    <TableRow key={gateway.id} className={theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}>
                      <TableCell className={`font-medium ${textPrimary}`}>{gateway.name}</TableCell>
                      <TableCell className="font-mono text-xs text-blue-400">{gateway.dev_eui || <span className={textMuted}>—</span>}</TableCell>
                      <TableCell className={`font-mono text-xs ${textMuted}`}>{gateway.id.substring(0, 12)}...</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{gateway.latitude.toFixed(4)}</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{gateway.longitude.toFixed(4)}</TableCell>
                      <TableCell>
                        <span className={`badge ${gateway.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {gateway.status === 'active' ? 'Activ' : 'Inactiv'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(gateway)} className={textSecondary}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedGateway(gateway); setDeleteDialogOpen(true); }} className={`${textSecondary} hover:text-red-400`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}>{selectedGateway ? "Editează" : "Adaugă"} Gateway</DialogTitle>
            <DialogDescription className={textSecondary}>Detalii gateway LoRaWAN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className={textSecondary}>DevEUI (Opțional)</Label>
              <Input value={formData.dev_eui} onChange={(e) => setFormData({ ...formData, dev_eui: e.target.value })} placeholder="AA00BB11CC22DD33" className={`${inputClass} font-mono`} />
              <p className={`text-xs ${textMuted}`}>ID din ChirpStack pentru identificare</p>
            </div>
            <div className="space-y-2">
              <Label className={textSecondary}>Nume</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Gateway Nord" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={textSecondary}>Latitudine</Label>
                <Input type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              <div className="space-y-2">
                <Label className={textSecondary}>Longitudine</Label>
                <Input type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
            </div>
            <div className={`flex items-center gap-2 p-3 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
              <MapPin className="w-4 h-4 text-blue-500" />
              <span className={`text-xs ${textMuted}`}>Coordonate din Google Maps</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white">{selectedGateway ? "Salvează" : "Adaugă"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}>Confirmare Ștergere</DialogTitle>
            <DialogDescription className={textSecondary}>Ștergeți "{selectedGateway?.name}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white">Șterge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Frequency Distribution Chart */}
      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className={`text-base font-heading ${textPrimary} flex items-center gap-2`}>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Distribuție Frecvențe (Received / Frequency)
            </CardTitle>
            <Select value={freqGatewayId} onValueChange={setFreqGatewayId}>
              <SelectTrigger className={`w-[220px] h-8 text-xs ${inputClass}`}>
                <SelectValue placeholder="Selectează gateway" />
              </SelectTrigger>
              <SelectContent className={dialogClass}>
                {gateways.map(gw => (
                  <SelectItem key={gw.id} value={gw.dev_eui || gw.id} className={textSecondary}>
                    {gw.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {freqLoading ? (
            <div className={`h-64 flex items-center justify-center ${textMuted}`}>
              <p className="text-sm">Se încarcă...</p>
            </div>
          ) : freqData.frequencies.length === 0 ? (
            <div className={`h-64 flex items-center justify-center ${textMuted}`}>
              <p className="text-sm">Nu există date de frecvență pentru acest gateway. Trimiteți uplink-uri cu informații txInfo.frequency.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={freqData.frequencies} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#3f3f46" : "#e2e8f0"} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 11 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme === "dark" ? "#18181b" : "#ffffff",
                    border: `1px solid ${theme === "dark" ? "#3f3f46" : "#e2e8f0"}`,
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                  formatter={(value) => [`${value} mesaje`, "Recepții"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {freqData.frequencies.map((entry, index) => {
                    const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#818cf8", "#7c3aed", "#6d28d9", "#5b21b6"];
                    return <Cell key={index} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {freqData.total_messages > 0 && (
            <p className={`text-xs text-center mt-2 ${textMuted}`}>
              Total: {freqData.total_messages} mesaje pe {freqData.frequencies.length} frecvențe
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
