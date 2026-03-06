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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Radio, Upload, FileText, Download } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Get SF badge class
const getSFBadgeClass = (sf) => {
  if (sf === null || sf === undefined) return "badge-info";
  if (sf <= 8) return "badge-success";
  if (sf <= 10) return "badge-warning";
  return "badge-danger";
};

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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
    const template = "dev_eui,name,latitude,longitude\n0011223344556677,Sensor Example,44.4268,26.1025";
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
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Ultimul SF</TableHead>
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
                        <span className={`badge ${getSFBadgeClass(device.last_sf)}`}>
                          {device.last_sf !== null ? `SF${device.last_sf}` : "N/A"}
                        </span>
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
                placeholder="0011223344556677"
                className="bg-zinc-950 border-zinc-800 text-zinc-200 font-mono"
                disabled={!!selectedDevice}
                data-testid="device-deveui-input"
              />
              <p className="text-xs text-zinc-500">Identificator unic de 16 caractere hexazecimale</p>
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
                <strong className="text-zinc-300">Notă:</strong> Fișierul CSV trebuie să conțină coloanele: 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">dev_eui</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">name</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">latitude</code>, 
                <code className="mx-1 px-1 bg-zinc-800 rounded text-emerald-400">longitude</code>
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
    </div>
  );
}
