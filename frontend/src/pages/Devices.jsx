import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Radio, Upload, FileText, Download, Info, BarChart3 } from "lucide-react";
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

  // Theme classes
  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-slate-200 text-slate-900";
  const dialogClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";
  const infoCardClass = theme === "dark" ? "border-blue-600/30 bg-blue-950/10" : "border-blue-200 bg-blue-50";

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
        toast.success("Dispozitiv actualizat cu succes");
      } else {
        await axios.post(`${API}/devices`, payload);
        toast.success("Dispozitiv adăugat cu succes");
      }
      setDialogOpen(false);
      fetchDevices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare la salvarea dispozitivului");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/devices/${selectedDevice.id}`);
      toast.success("Dispozitiv șters cu succes");
      setDeleteDialogOpen(false);
      setSelectedDevice(null);
      fetchDevices();
    } catch (error) {
      toast.error("Eroare la ștergerea dispozitivului");
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error("Vă rugăm selectați un fișier CSV"); return; }
    setCsvFile(file);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => { setCsvPreview(results.data.slice(0, 5)); setImportDialogOpen(true); },
      error: () => { toast.error("Eroare la parsarea fișierului CSV"); }
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
      if (imported > 0) toast.success(`${imported} dispozitive importate cu succes`);
      if (skipped > 0) toast.warning(`${skipped} dispozitive ignorate`);
      setImportDialogOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchDevices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare la import");
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
      <Card className={`${cardClass} ${infoCardClass}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-500">Sistem de Mediere SF</p>
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Fiecare dispozitiv păstrează ultimele <strong>10 valori SF</strong>. Culoarea pe heatmap este <strong>media aritmetică</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-emerald-500" />
              <CardTitle className={`text-xl font-heading font-semibold ${textPrimary}`}>Dispozitive LoRaWAN</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" onClick={downloadTemplate} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>
                <Download className="w-4 h-4 mr-2" />Template CSV
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>
                <Upload className="w-4 h-4 mr-2" />Import CSV
              </Button>
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="w-4 h-4 mr-2" />Adaugă Dispozitiv
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="loading-spinner"></div></div>
          ) : devices.length === 0 ? (
            <div className="empty-state">
              <Radio className="empty-state-icon" />
              <p className={textMuted}>Nu există dispozitive înregistrate</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={theme === "dark" ? "border-zinc-800" : "border-slate-200"}>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Nume</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>DevEUI</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Latitudine</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Longitudine</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>
                      <TooltipProvider><Tooltip><TooltipTrigger className="flex items-center gap-1">SF Mediu<Info className="w-3 h-3" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Media ultimelor 10 valori SF</p></TooltipContent></Tooltip></TooltipProvider>
                    </TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Buffer</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted}`}>Ultima Activitate</TableHead>
                    <TableHead className={`font-mono text-xs uppercase ${textMuted} text-right`}>Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} className={theme === "dark" ? "border-zinc-800/50 hover:bg-zinc-900/50" : "border-slate-100 hover:bg-slate-50"}>
                      <TableCell className={`font-medium ${textPrimary}`}>{device.name}</TableCell>
                      <TableCell className={`font-mono text-xs ${textSecondary}`}>{device.dev_eui}</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{device.latitude.toFixed(6)}</TableCell>
                      <TableCell className={`font-mono text-sm ${textSecondary}`}>{device.longitude.toFixed(6)}</TableCell>
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
            <DialogTitle className={`font-heading ${textPrimary}`}>{selectedDevice ? "Editează Dispozitiv" : "Adaugă Dispozitiv"}</DialogTitle>
            <DialogDescription className={textSecondary}>Introduceți detaliile dispozitivului LoRaWAN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className={textSecondary}>DevEUI</Label>
              <Input value={formData.dev_eui} onChange={(e) => setFormData({ ...formData, dev_eui: e.target.value })} placeholder="a84041000012345" className={`${inputClass} font-mono`} disabled={!!selectedDevice} />
            </div>
            <div className="space-y-2">
              <Label className={textSecondary}>Nume</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Sensor Parc Central" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={textSecondary}>Latitudine</Label>
                <Input type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="44.4268" className={`${inputClass} font-mono`} />
              </div>
              <div className="space-y-2">
                <Label className={textSecondary}>Longitudine</Label>
                <Input type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="26.1025" className={`${inputClass} font-mono`} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>Anulează</Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white">{selectedDevice ? "Salvează" : "Adaugă"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary}`}>Confirmare Ștergere</DialogTitle>
            <DialogDescription className={textSecondary}>Sigur doriți să ștergeți dispozitivul "{selectedDevice?.name}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>Anulează</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white">Șterge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className={`${dialogClass} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className={`font-heading ${textPrimary} flex items-center gap-2`}><FileText className="w-5 h-5 text-emerald-500" />Previzualizare Import CSV</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {csvPreview.length > 0 && (
              <div className={`overflow-x-auto border rounded-sm ${theme === "dark" ? "border-zinc-800" : "border-slate-200"}`}>
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
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setCsvFile(null); setCsvPreview([]); }} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>Anulează</Button>
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
            <DialogTitle className={`font-heading ${textPrimary} flex items-center gap-2`}><BarChart3 className="w-5 h-5 text-blue-500" />Buffer SF - {selectedDevice?.name}</DialogTitle>
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
                    <span className={`text-sm ${textSecondary}`}>Media calculată:</span>
                    <span className="text-xl font-bold font-mono" style={{ color: getSFColor(selectedDevice.sf_average) }}>{selectedDevice.sf_average?.toFixed(2)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className={`text-center py-8 ${textMuted}`}><BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Nu există date în buffer</p></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBufferDialogOpen(false)} className={theme === "dark" ? "border-zinc-700 text-zinc-300" : "border-slate-200"}>Închide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
