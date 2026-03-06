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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Get SF badge class based on AVERAGE
const getSFBadgeClass = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "badge-info";
  if (sfAvg <= 8.5) return "badge-success";
  if (sfAvg <= 10.5) return "badge-warning";
  return "badge-danger";
};

// Get color for SF value
const getSFColor = (sfAvg) => {
  if (sfAvg === null || sfAvg === undefined) return "#71717a";
  if (sfAvg <= 8.5) return "#10b981";
  if (sfAvg <= 10.5) return "#f59e0b";
  return "#ef4444";
};

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bufferDialogOpen, setBufferDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({
    dev_eui: "",
    name: "",
    latitude: "",
    longitude: ""
  });
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleOpenDialog = (device = null) => {
    if (device) {
      setSelectedDevice(device);
      setFormData({
        dev_eui: device.dev_eui,
        name: device.name,
        latitude: device.latitude.toString(),
        longitude: device.longitude.toString()
      });
    } else {
      setSelectedDevice(null);
      setFormData({
        dev_eui: "",
        name: "",
        latitude: "",
        longitude: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        dev_eui: formData.dev_eui,
        name: formData.name,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      };

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

  const openDeleteDialog = (device) => {
    setSelectedDevice(device);
    setDeleteDialogOpen(true);
  };

  const openBufferDialog = (device) => {
    setSelectedDevice(device);
    setBufferDialogOpen(true);
  };

  // CSV Import Functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Vă rugăm selectați un fișier CSV");
      return;
    }

    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvPreview(results.data.slice(0, 5));
        setImportDialogOpen(true);
      },
      error: (error) => {
        toast.error("Eroare la parsarea fișierului CSV");
        console.error(error);
      }
    });
  };

  const handleImport = async () => {
    if (!csvFile) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await axios.post(`${API}/devices/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { imported, skipped, errors } = response.data;
      
      if (imported > 0) {
        toast.success(`${imported} dispozitive importate cu succes`);
      }
      if (skipped > 0) {
        toast.warning(`${skipped} dispozitive ignorate (duplicate sau erori)`);
      }
      if (errors.length > 0) {
        console.log("Import errors:", errors);
      }

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
    const template = "DevEUI,Name,Latitude,Longitude\na84041000012345,Senzor_Parcare_1,44.4268,26.1025\na84041000012346,Senzor_Parcare_2,44.4270,26.1030";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devices_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Niciodată";
    const date = new Date(timestamp);
    return date.toLocaleString('ro-RO');
  };

  return (
    <div className="space-y-4" data-testid="devices-page">
      {/* Info Card about SF Buffer */}
      <Card className="card-base border-blue-600/30 bg-blue-950/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-400">Sistem de Mediere SF</p>
              <p className="text-xs text-zinc-400 mt-1">
                Fiecare dispozitiv păstrează un buffer cu ultimele <strong>10 valori SF</strong>. 
                Culoarea pe heatmap este calculată din <strong>media aritmetică</strong> a acestor valori, 
                oferind o imagine mai precisă a calității semnalului în timp.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-emerald-500" />
              <CardTitle className="text-xl font-heading font-semibold text-zinc-100">
                Dispozitive LoRaWAN
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="csv-file-input"
              />
              <Button 
                variant="outline"
                onClick={downloadTemplate}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                data-testid="download-template-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Template CSV
              </Button>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                data-testid="import-csv-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button 
                onClick={() => handleOpenDialog()}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                data-testid="add-device-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adaugă Dispozitiv
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading-spinner"></div>
            </div>
          ) : devices.length === 0 ? (
            <div className="empty-state">
              <Radio className="empty-state-icon" />
              <p className="text-zinc-500">Nu există dispozitive înregistrate</p>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Button 
                  onClick={() => handleOpenDialog()}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  Adaugă manual
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="devices-table">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Nume</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">DevEUI</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Latitudine</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Longitudine</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            SF Mediu
                            <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-800 border-zinc-700">
                            <p className="text-xs">Media ultimelor 10 valori SF</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Buffer</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Ultima Activitate</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow 
                      key={device.id} 
                      className="border-zinc-800/50 hover:bg-zinc-900/50"
                      data-testid={`device-row-${device.id}`}
                    >
                      <TableCell className="font-medium text-zinc-200">{device.name}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{device.dev_eui}</TableCell>
                      <TableCell className="font-mono text-sm text-zinc-300">{device.latitude.toFixed(6)}</TableCell>
                      <TableCell className="font-mono text-sm text-zinc-300">{device.longitude.toFixed(6)}</TableCell>
                      <TableCell>
                        <span 
                          className={`badge ${getSFBadgeClass(device.sf_average)}`}
                          style={{ borderColor: getSFColor(device.sf_average) + '50' }}
                        >
                          {device.sf_average !== null ? device.sf_average.toFixed(1) : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBufferDialog(device)}
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-7 px-2"
                          data-testid={`view-buffer-${device.id}`}
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          <span className="text-xs">{device.sf_buffer?.length || 0}/10</span>
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {formatLastSeen(device.last_seen)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(device)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                            data-testid={`edit-device-${device.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(device)}
                            className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                            data-testid={`delete-device-${device.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
        <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="device-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading">
              {selectedDevice ? "Editează Dispozitiv" : "Adaugă Dispozitiv"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Introduceți detaliile dispozitivului LoRaWAN
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">DevEUI</Label>
              <Input
                value={formData.dev_eui}
                onChange={(e) => setFormData({ ...formData, dev_eui: e.target.value })}
                placeholder="a84041000012345"
                className="bg-zinc-950 border-zinc-800 text-zinc-200 font-mono"
                disabled={!!selectedDevice}
                data-testid="device-deveui-input"
              />
              <p className="text-xs text-zinc-500">Identificator unic de 16 caractere hexazecimale (din ChirpStack)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Nume</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Sensor Parc Central"
                className="bg-zinc-950 border-zinc-800 text-zinc-200"
                data-testid="device-name-input"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Latitudine</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="44.4268"
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 font-mono"
                  data-testid="device-lat-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Longitudine</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="26.1025"
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 font-mono"
                  data-testid="device-lng-input"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-950/20 rounded-sm border border-blue-800/30">
              <p className="text-xs text-blue-400">
                <strong>Important:</strong> Dispozitivele LoRaWAN nu au GPS. Introduceți manual coordonatele locației unde este montat senzorul.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Anulează
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="save-device-btn"
            >
              {selectedDevice ? "Salvează" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="delete-device-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading">Confirmare Ștergere</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Sigur doriți să ștergeți dispozitivul "{selectedDevice?.name}"? Această acțiune nu poate fi anulată.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Anulează
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
              data-testid="confirm-delete-device"
            >
              Șterge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl" data-testid="import-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Previzualizare Import CSV
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Verificați datele înainte de import. Se vor afișa primele 5 înregistrări.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {csvPreview.length > 0 ? (
              <div className="overflow-x-auto border border-zinc-800 rounded-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      {Object.keys(csvPreview[0]).map((key) => (
                        <TableHead key={key} className="text-zinc-500 font-mono text-xs uppercase">
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.map((row, index) => (
                      <TableRow key={index} className="border-zinc-800/50">
                        {Object.values(row).map((value, i) => (
                          <TableCell key={i} className="font-mono text-xs text-zinc-300">
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">Nu există date de previzualizat</p>
            )}

            <div className="mt-4 p-3 bg-zinc-950 rounded-sm border border-zinc-800">
              <p className="text-xs text-zinc-400">
                <strong className="text-zinc-300">Format acceptat:</strong> CSV cu coloanele 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">DevEUI</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">Name</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">Latitude</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">Longitude</code>
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                La primirea mesajelor prin webhook, DevEUI-ul va fi asociat automat cu coordonatele GPS introduse.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setCsvFile(null);
                setCsvPreview([]);
              }}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Anulează
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="confirm-import-btn"
            >
              {importing ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Import...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importă Dispozitive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SF Buffer View Dialog */}
      <Dialog open={bufferDialogOpen} onOpenChange={setBufferDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="buffer-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Buffer SF - {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Ultimele 10 valori Spreading Factor primite
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedDevice?.sf_buffer && selectedDevice.sf_buffer.length > 0 ? (
              <>
                <div className="flex gap-2 flex-wrap mb-4">
                  {selectedDevice.sf_buffer.map((sf, index) => (
                    <div 
                      key={index}
                      className="w-12 h-12 flex items-center justify-center rounded border font-mono text-sm font-bold"
                      style={{ 
                        backgroundColor: getSFColor(sf) + '20',
                        borderColor: getSFColor(sf),
                        color: getSFColor(sf)
                      }}
                    >
                      {sf}
                    </div>
                  ))}
                </div>
                
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400">Media calculată:</span>
                    <span 
                      className="text-xl font-bold font-mono"
                      style={{ color: getSFColor(selectedDevice.sf_average) }}
                    >
                      {selectedDevice.sf_average?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-zinc-500">Măsurători în buffer:</span>
                    <span className="text-xs text-zinc-400">{selectedDevice.sf_buffer.length}/10</span>
                  </div>
                </div>
                
                <p className="text-xs text-zinc-500 mt-4">
                  Buffer-ul funcționează în mod FIFO (First In, First Out). 
                  La fiecare uplink nou, cea mai veche valoare este eliminată și se adaugă noua valoare.
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Nu există date în buffer</p>
                <p className="text-xs mt-1">Buffer-ul se populează la primirea mesajelor uplink</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBufferDialogOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Închide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
