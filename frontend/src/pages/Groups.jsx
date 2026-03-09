import { useState, useEffect, useMemo } from "react";
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
import { Plus, Pencil, Trash2, FolderOpen, Search, Users } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Groups() {
  const { theme } = useTheme();
  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const cardClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm";
  const textPrimary = theme === "dark" ? "text-white" : "text-slate-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-slate-600";
  const textMuted = theme === "dark" ? "text-zinc-500" : "text-slate-500";
  const inputClass = theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-slate-200 text-slate-900";
  const dialogClass = theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";

  const fetchData = async () => {
    try {
      setLoading(true);
      const [groupsRes, devicesRes] = await Promise.all([
        axios.get(`${API}/groups`),
        axios.get(`${API}/devices`)
      ]);
      setGroups(groupsRes.data);
      setDevices(devicesRes.data);
    } catch (error) {
      toast.error("Eroare la încărcarea datelor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const term = searchTerm.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(term) ||
      (g.description || "").toLowerCase().includes(term)
    );
  }, [groups, searchTerm]);

  // Count devices per group
  const deviceCounts = useMemo(() => {
    const counts = {};
    devices.forEach(d => {
      const gid = d.group_id || "unassigned";
      counts[gid] = (counts[gid] || 0) + 1;
    });
    return counts;
  }, [devices]);

  const openCreateDialog = () => {
    setSelectedGroup(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (group) => {
    setSelectedGroup(group);
    setFormData({ name: group.name, description: group.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Numele grupului este obligatoriu");
      return;
    }
    try {
      if (selectedGroup) {
        await axios.put(`${API}/groups/${selectedGroup.id}`, formData);
        toast.success("Grup actualizat");
      } else {
        await axios.post(`${API}/groups`, formData);
        toast.success("Grup creat");
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Eroare la salvare");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/groups/${selectedGroup.id}`);
      toast.success("Grup șters. Dispozitivele au fost dezasignate.");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Eroare la ștergere");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className={cardClass}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`relative flex-1 max-w-md`}>
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
              <Input
                placeholder="Caută după nume sau descriere..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${inputClass}`}
              />
            </div>
            <span className={`text-sm ${textMuted}`}>{filteredGroups.length} din {groups.length}</span>
            <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-500 text-white ml-auto">
              <Plus className="w-4 h-4 mr-2" />
              Adaugă Grup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cardClass}>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-500" />
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{groups.length}</p>
              <p className={`text-xs uppercase tracking-wider ${textMuted}`}>Grupuri</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-500" />
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{devices.length - (deviceCounts["unassigned"] || 0)}</p>
              <p className={`text-xs uppercase tracking-wider ${textMuted}`}>Dispozitive asignate</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-500" />
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{deviceCounts["unassigned"] || 0}</p>
              <p className={`text-xs uppercase tracking-wider ${textMuted}`}>Neasignate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups Table */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className={`text-lg font-heading ${textPrimary} flex items-center gap-2`}>
            <FolderOpen className="w-5 h-5 text-blue-500" />
            Grupuri / Proiecte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className={theme === "dark" ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-200 hover:bg-slate-50"}>
                <TableHead className={`${textSecondary} font-mono text-xs uppercase`}>Nume</TableHead>
                <TableHead className={`${textSecondary} font-mono text-xs uppercase`}>Descriere</TableHead>
                <TableHead className={`${textSecondary} font-mono text-xs uppercase`}>Dispozitive</TableHead>
                <TableHead className={`${textSecondary} font-mono text-xs uppercase`}>Creat la</TableHead>
                <TableHead className={`${textSecondary} font-mono text-xs uppercase text-right`}>Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={`text-center py-8 ${textMuted}`}>
                    {loading ? "Se încarcă..." : "Niciun grup. Creați primul grup."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id} className={theme === "dark" ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-200 hover:bg-slate-50"}>
                    <TableCell className={`font-semibold ${textPrimary}`}>{group.name}</TableCell>
                    <TableCell className={textSecondary}>{group.description || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                        (deviceCounts[group.id] || 0) > 0
                          ? "bg-blue-500/20 text-blue-400"
                          : theme === "dark" ? "bg-zinc-800 text-zinc-500" : "bg-slate-100 text-slate-500"
                      }`}>
                        {deviceCounts[group.id] || 0}
                      </span>
                    </TableCell>
                    <TableCell className={`text-xs ${textMuted}`}>
                      {new Date(group.created_at).toLocaleDateString("ro-RO")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)} className={textSecondary}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedGroup(group); setDeleteDialogOpen(true); }} className="text-red-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={textPrimary}>
              {selectedGroup ? "Editează Grup" : "Grup Nou"}
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              {selectedGroup ? "Modifică detaliile grupului" : "Creează un grup nou pentru organizarea dispozitivelor"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className={textSecondary}>Nume *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                placeholder="ex: București Nord"
              />
            </div>
            <div>
              <Label className={textSecondary}>Descriere</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass}
                placeholder="ex: Senzori zona de nord"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className={textSecondary}>Anulează</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white">
              {selectedGroup ? "Salvează" : "Creează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className="text-red-500">Șterge Grupul</DialogTitle>
            <DialogDescription className={textSecondary}>
              Ești sigur că vrei să ștergi grupul "{selectedGroup?.name}"?
              Dispozitivele din acest grup vor fi dezasignate (nu vor fi șterse).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className={textSecondary}>Anulează</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white">Șterge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
