import { useState, useEffect } from "react";
import axios from "axios";
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
import { Plus, Pencil, Trash2, Router, MapPin } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Gateways() {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
    status: "active"
  });

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

  useEffect(() => {
    fetchGateways();
  }, []);

  const handleOpenDialog = (gateway = null) => {
    if (gateway) {
      setSelectedGateway(gateway);
      setFormData({
        name: gateway.name,
        latitude: gateway.latitude.toString(),
        longitude: gateway.longitude.toString(),
        status: gateway.status
      });
    } else {
      setSelectedGateway(null);
      setFormData({
        name: "",
        latitude: "",
        longitude: "",
        status: "active"
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        status: formData.status
      };

      if (selectedGateway) {
        await axios.put(`${API}/gateways/${selectedGateway.id}`, payload);
        toast.success("Gateway actualizat cu succes");
      } else {
        await axios.post(`${API}/gateways`, payload);
        toast.success("Gateway adăugat cu succes");
      }

      setDialogOpen(false);
      fetchGateways();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare la salvarea gateway-ului");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/gateways/${selectedGateway.id}`);
      toast.success("Gateway șters cu succes");
      setDeleteDialogOpen(false);
      setSelectedGateway(null);
      fetchGateways();
    } catch (error) {
      toast.error("Eroare la ștergerea gateway-ului");
    }
  };

  const openDeleteDialog = (gateway) => {
    setSelectedGateway(gateway);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4" data-testid="gateways-page">
      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Router className="w-6 h-6 text-blue-500" />
              <CardTitle className="text-xl font-heading font-semibold text-zinc-100">
                Gateway-uri LoRaWAN
              </CardTitle>
            </div>
            <Button 
              onClick={() => handleOpenDialog()}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="add-gateway-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adaugă Gateway
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading-spinner"></div>
            </div>
          ) : gateways.length === 0 ? (
            <div className="empty-state">
              <Router className="empty-state-icon" />
              <p className="text-zinc-500">Nu există gateway-uri înregistrate</p>
              <Button 
                onClick={() => handleOpenDialog()}
                className="mt-4 bg-blue-600 hover:bg-blue-500"
              >
                Adaugă primul gateway
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="gateways-table">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Nume</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">ID</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Latitudine</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Longitudine</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase">Status</TableHead>
                    <TableHead className="text-zinc-500 font-mono text-xs uppercase text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateways.map((gateway) => (
                    <TableRow 
                      key={gateway.id} 
                      className="border-zinc-800/50 hover:bg-zinc-900/50"
                      data-testid={`gateway-row-${gateway.id}`}
                    >
                      <TableCell className="font-medium text-zinc-200">{gateway.name}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{gateway.id}</TableCell>
                      <TableCell className="font-mono text-sm text-zinc-300">{gateway.latitude.toFixed(6)}</TableCell>
                      <TableCell className="font-mono text-sm text-zinc-300">{gateway.longitude.toFixed(6)}</TableCell>
                      <TableCell>
                        <span className={`badge ${gateway.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {gateway.status === 'active' ? 'Activ' : 'Inactiv'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(gateway)}
                            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                            data-testid={`edit-gateway-${gateway.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(gateway)}
                            className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                            data-testid={`delete-gateway-${gateway.id}`}
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
        <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="gateway-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading">
              {selectedGateway ? "Editează Gateway" : "Adaugă Gateway"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Introduceți detaliile gateway-ului LoRaWAN
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Nume</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Gateway București Nord"
                className="bg-zinc-950 border-zinc-800 text-zinc-200"
                data-testid="gateway-name-input"
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
                  data-testid="gateway-lat-input"
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
                  data-testid="gateway-lng-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-zinc-950 rounded-sm border border-zinc-800">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-zinc-400">
                Coordonatele GPS pot fi obținute din Google Maps sau alte servicii de hartă
              </span>
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
              data-testid="save-gateway-btn"
            >
              {selectedGateway ? "Salvează" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="delete-gateway-dialog">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 font-heading">Confirmare Ștergere</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Sigur doriți să ștergeți gateway-ul "{selectedGateway?.name}"? Această acțiune nu poate fi anulată.
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
              data-testid="confirm-delete-gateway"
            >
              Șterge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
