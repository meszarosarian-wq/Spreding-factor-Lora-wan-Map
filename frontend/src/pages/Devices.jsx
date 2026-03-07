import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import Papa from "papaparse";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Radio, Upload, FileText, Download, Info, BarChart3, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getSFBadgeClass = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "badge-info";
  if (sfAvg <= 8.5) return "badge-success";
  if (sfAvg <= 10.5) return "badge-warning";
  return "badge-danger";
};

const getSFColor = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "#71717a";
  if (sfAvg <= 8.5) return "#10b981";
  if (sfAvg <= 10.5) return "#f59e0b";
  return "#ef4444";
};

export default function Devices() {
  const { theme } = useTheme();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bufferDialogOpen, setBufferDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({ dev_eui: "", name: "", latitude: "", longitude: "" });
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Search and Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filterSF, setFilterSF] = useState("all");

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-slate-200 text-slate-900";
  const dialogClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/devices`);
      setDevices(response.data);
    } catch (error) {
      toast.error("Eroare la încărcarea dispozitivelor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  // Filtered and sorted data
  const filteredDevices = useMemo(() => {
    let result = [...devices];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(term) ||
        d.dev_eui.toLowerCase().includes(term)
      );
    }
    
    // Filter by SF quality
    if (filterSF === "good") {
      result = result.filter(d => d.sf_average !== null && d.sf_average <= 8.5);
    } else if (filterSF === "medium") {
      result = result.filter(d => d.sf_average !== null && d.sf_average > 8.5 && d.sf_average <= 10.5);
    } else if (filterSF === "bad") {
      result = result.filter(d => d.sf_average !== null && d.sf_average > 10.5);
    } else if (filterSF === "nodata") {
      result = result.filter(d => d.sf_average === null || d.sf_buffer?.length === 0);
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
          aVal = a.dev_eui;
          bVal = b.dev_eui;
          break;
        case "sf_average":
          aVal = a.sf_average ?? 999;
          bVal = b.sf_average ?? 999;
          break;
        case "buffer":
          aVal = a.sf_buffer?.length ?? 0;
          bVal = b.sf_buffer?.length ?? 0;
          break;
        case "last_seen":
          aVal = a.last_seen ? new Date(a.last_seen).getTime() : 0;
          bVal = b.last_seen ? new Date(b.last_seen).getTime() : 0;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [devices, searchTerm, filterSF, sortField, sortDirection]);

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
    setFilterSF("all");
    setSortField("name");
    setSortDirection("asc");
  };

  const hasActiveFilters = searchTerm || filterSF !== "all" || sortField !== "name";

  const handleOpenDialog = (device = null) => {
    if (device) {
      setSelectedDevice(device);
      setFormData({ dev_eui: device.dev_eui, name: device.name, latitude: device.latitude.toString(), longitude: device.longitude.toString() });
    } else {
      setSelectedDevice(null);
      setFormData({ dev_eui: "", name: "", latitude: "", longitude: "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = { dev_eui: formData.dev_eui, name: formData.name, latitude: parseFloat(formData.latitude), longitude: parseFloat(formData.longitude) };
      if (selectedDevice) {
        await axios.put(`${API}/devices/${selectedDevice.id}`, payload);
        toast.success("Dispozitiv actualizat");
      } else {
        await axios.post(`${API}/devices`, payload);
        toast.success("Dispozitiv adăugat");
      }
      setDialogOpen(false);
      fetchDevices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/devices/${selectedDevice.id}`);
      toast.success("Dispozitiv șters");
      setDeleteDialogOpen(false);
      setSelectedDevice(null);
      fetchDevices();
    } catch (error) {
      toast.error("Eroare la ștergere");
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error("Selectați un fișier CSV"); return; }
    setCsvFile(file);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => { setCsvPreview(results.data.slice(0, 5)); setImportDialogOpen(true); },
      error: () => { toast.error("Eroare la parsare CSV"); }
    });
  };

  const handleImport = async () => {
    if (!csvFile) return;
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', csvFile);
      const response = await axios.post(`${API}/devices/import-csv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { imported, skipped } = response.data;
      if (imported > 0) toast.success(`${imported} dispozitive importate`);
      if (skipped > 0) toast.warning(`${skipped} ignorate`);
      setImportDialogOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchDevices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare import");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = "DevEUI,Name,Latitude,Longitude\na84041000012345,Senzor_Parcare_1,44.4268,26.1025";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'devices_template.csv'; a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Niciodată";
    return new Date(timestamp).toLocaleString('ro-RO');
  };

  return (
    <div className="space-y-4" data-testid="devices-page">
      {/* Info Card */}
      <Card className={`${cardClass} ${theme === "dark" ? "border-blue-600/30 bg-blue-950/10" : "border-blue-200 bg-blue-50"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-500">Sistem de Mediere SF</p>
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Buffer de <strong>10 valori SF</strong> per dispozitiv. Heatmap folosește <strong>media aritmetică</strong>.
              </p>
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
                placeholder="Caută după nume sau DevEUI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${inputClass}`}
              />
            </div>
            
            <Select value={filterSF} onValueChange={setFilterSF}>
              <SelectTrigger className={`w-[180px] ${inputClass}`}>
                <SelectValue placeholder="Calitate SF" />
              </SelectTrigger>
              <SelectContent className={dialogClass}>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="good">🟢 Excelent (≤8.5)</SelectItem>
                <SelectItem value="medium">🟠 Mediu (8.6-10.5)</SelectItem>
                <SelectItem value="bad">🔴 Slab (&gt;10.5)</SelectItem>
                <SelectItem value="nodata">⚪ Fără date</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className={textSecondary}>
                <X className="w-4 h-4 mr-1" />Resetează
              </Button>
            )}

            <span className={`text-sm ${textMuted}`}>{filteredDevices.length} din {devices.length}</span>

            <div className="ml-auto flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" onClick={downloadTemplate} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : ""}>
                <Download className="w-4 h-4 mr-2" />Template
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : ""}>
                <Upload className="w-4 h-4 mr-2" />Import CSV
              </Button>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="w-4 h-4 mr-2" />Adaugă
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card className={cardClass}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-emerald-500" />
            <CardTitle className={`text-xl font-heading font-semibold ${textPrimary}`}>Dispozitive LoRaWAN</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="loading-spinner"></div></div>
          ) : filteredDevices.length === 0 ? (
            <div className="empty-state">
              <Radio className="empty-state-icon" />
              <p className={textMuted}>{searchTerm ? "Nu s-au găsit rezultate" : "Nu există dispozitive"}</p>
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
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Lat</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Lng</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("sf_average")}>
                      <span className="flex items-center">SF Mediu<SortIcon field="sf_average" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("buffer")}>
                      <span className="flex items-center">Buffer<SortIcon field="buffer" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} cursor-pointer hover:text-blue-500`} onClick={() => handleSort("last_seen")}>
                      <span className="flex items-center">Ultima Activitate<SortIcon field="last_seen" /></span>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} text-right`}>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id} className={theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}>
                      <TableCell className={`font-medium ${textPrimary}`}>{device.name}</TableCell>
                      <TableCell className={`font-mono text-xs ${textSecondary}`}>{device.dev_eui}</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{device.latitude.toFixed(4)}</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{device.longitude.toFixed(4)}</TableCell>
                      <TableCell>
                        <span className={`badge ${getSFBadgeClass(device.sf_average)}`}>
                          {device.sf_average !== null ? device.sf_average.toFixed(1) : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedDevice(device); setBufferDialogOpen(true); }} className={`${textSecondary} h-7 px-2`}>
                          <BarChart3 className="w-3 h-3 mr-1" /><span className="text-xs">{device.sf_buffer?.length || 0}/10</span>
                        </Button>
                      </TableCell>
                      <TableCell className={`text-xs ${textSecondary}`}>{formatLastSeen(device.last_seen)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(device)} className={textSecondary}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedDevice(device); setDeleteDialogOpen(true); }} className={`${textSecondary} hover:text-red-400`}><Trash2 className="w-4 h-4" /></Button>
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
            <DialogTitle className={`font-heading ${textPrimary}`}>{selectedDevice ? "Editează" : "Adaugă"} Dispozitiv</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className={textSecondary}>DevEUI</Label>
              <Input value={formData.dev_eui} onChange={(e) => setFormData({ ...formData, dev_eui: e.target.value })} placeholder="a84041000012345" className={`${inputClass} font-mono`} disabled={!!selectedDevice} />
            </div>
            <div className="space-y-2">
              <Label className={textSecondary}>Nume</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Sensor Parc" className={inputClass} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white">{selectedDevice ? "Salvează" : "Adaugă"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}>Confirmare Ștergere</DialogTitle>
            <DialogDescription className={textSecondary}>Ștergeți "{selectedDevice?.name}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Anulează</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white">Șterge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className={`${dialogClass} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}><FileText className="w-5 h-5 inline mr-2 text-emerald-500" />Import CSV</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {csvPreview.length > 0 && (
              <div className={`overflow-x-auto border rounded ${theme === "dark" ? "border-zinc-800" : "border-slate-200"}`}>
                <Table>
                  <TableHeader>
                    <TableRow>{Object.keys(csvPreview[0]).map((key) => (<TableHead key={key} className={`font-mono text-xs ${textMuted}`}>{key}</TableHead>))}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.map((row, i) => (<TableRow key={i}>{Object.values(row).map((v, j) => (<TableCell key={j} className={`font-mono text-xs ${textSecondary}`}>{v}</TableCell>))}</TableRow>))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setCsvFile(null); setCsvPreview([]); }}>Anulează</Button>
            <Button onClick={handleImport} disabled={importing} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {importing ? "Import..." : <><Upload className="w-4 h-4 mr-2" />Importă</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buffer Dialog */}
      <Dialog open={bufferDialogOpen} onOpenChange={setBufferDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}><BarChart3 className="w-5 h-5 inline mr-2 text-blue-500" />Buffer SF - {selectedDevice?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedDevice?.sf_buffer?.length > 0 ? (
              <>
                <div className="flex gap-2 flex-wrap mb-4">
                  {selectedDevice.sf_buffer.map((sf, i) => (
                    <div key={i} className="w-12 h-12 flex items-center justify-center rounded border font-mono text-sm font-bold" style={{ backgroundColor: getSFColor(sf) + '20', borderColor: getSFColor(sf), color: getSFColor(sf) }}>{sf}</div>
                  ))}
                </div>
                <div className={`p-3 rounded border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${textSecondary}`}>Media:</span>
                    <span className="text-xl font-bold font-mono" style={{ color: getSFColor(selectedDevice.sf_average) }}>{selectedDevice.sf_average?.toFixed(2)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className={`text-center py-8 ${textMuted}`}><BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Fără date</p></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBufferDialogOpen(false)}>Închide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
