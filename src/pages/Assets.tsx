import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Building2, Car, Laptop, Package, Pencil, Trash2, Home, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ASSET_TYPES = [
  { value: 'immobilie', label: 'Immobilie', icon: Home },
  { value: 'fahrzeug', label: 'Fahrzeug', icon: Car },
  { value: 'ausstattung', label: 'Büroausstattung', icon: Laptop },
  { value: 'maschine', label: 'Maschine/Anlage', icon: Package },
  { value: 'beteiligung', label: 'Beteiligung', icon: Building2 },
  { value: 'sonstige', label: 'Sonstige', icon: Package },
] as const;

interface Asset {
  id: string;
  company_id: string;
  name: string;
  type: string;
  description: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  units: number | null;
  area_sqm: number | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetForm {
  name: string;
  type: string;
  description: string;
  purchase_date: string;
  purchase_price: string;
  current_value: string;
  address: string;
  city: string;
  zip: string;
  units: string;
  area_sqm: string;
  serial_number: string;
  notes: string;
}

const emptyForm: AssetForm = {
  name: '', type: 'sonstige', description: '', purchase_date: '',
  purchase_price: '', current_value: '', address: '', city: '', zip: '',
  units: '', area_sqm: '', serial_number: '', notes: '',
};

export default function Assets() {
  const { currentCompany } = useCompany();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany) fetchAssets();
  }, [currentCompany]);

  const fetchAssets = async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false })
      .limit(10000);
    if (data) setAssets(data);
    setLoading(false);
  };

  const formatCurrency = (v: number | null) => {
    if (v === null) return '-';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
  };

  const getTypeInfo = (type: string) => ASSET_TYPES.find(t => t.value === type) || ASSET_TYPES[5];

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.address?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || a.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [assets, searchQuery, filterType]);

  const pagination = usePagination(filteredAssets);

  const stats = useMemo(() => {
    const totalValue = assets.reduce((s, a) => s + (a.current_value || a.purchase_price || 0), 0);
    const immobilien = assets.filter(a => a.type === 'immobilie').length;
    return { total: assets.length, totalValue, immobilien };
  }, [assets]);

  const openCreate = () => {
    setEditingAsset(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      type: asset.type,
      description: asset.description || '',
      purchase_date: asset.purchase_date || '',
      purchase_price: asset.purchase_price?.toString() || '',
      current_value: asset.current_value?.toString() || '',
      address: asset.address || '',
      city: asset.city || '',
      zip: asset.zip || '',
      units: asset.units?.toString() || '',
      area_sqm: asset.area_sqm?.toString() || '',
      serial_number: asset.serial_number || '',
      notes: asset.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany || !form.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein.');
      return;
    }
    setSaving(true);
    const payload = {
      company_id: currentCompany.id,
      name: form.name.trim(),
      type: form.type,
      description: form.description || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price.replace(',', '.')) : null,
      current_value: form.current_value ? parseFloat(form.current_value.replace(',', '.')) : null,
      address: form.address || null,
      city: form.city || null,
      zip: form.zip || null,
      units: form.units ? parseInt(form.units) : null,
      area_sqm: form.area_sqm ? parseFloat(form.area_sqm.replace(',', '.')) : null,
      serial_number: form.serial_number || null,
      notes: form.notes || null,
    };

    let error;
    if (editingAsset) {
      ({ error } = await supabase.from('assets').update(payload).eq('id', editingAsset.id));
    } else {
      ({ error } = await supabase.from('assets').insert(payload));
    }

    if (error) {
      toast.error('Fehler beim Speichern.');
      console.error(error);
    } else {
      toast.success(editingAsset ? 'Vermögensgegenstand aktualisiert.' : 'Vermögensgegenstand erstellt.');
      setDialogOpen(false);
      fetchAssets();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) {
      toast.error('Fehler beim Löschen.');
    } else {
      toast.success('Vermögensgegenstand gelöscht.');
      fetchAssets();
    }
  };

  const updateField = (field: keyof AssetForm, value: string) => setForm(f => ({ ...f, [field]: value }));

  if (!currentCompany) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Vermögen</h1>
          <p className="text-muted-foreground">Vermögensgegenstände & Immobilien verwalten</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Vermögensgegenstand
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Gesamt</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Gesamtwert</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Immobilien</p>
          <p className="text-2xl font-bold">{stats.immobilien}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {ASSET_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Laden...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-2">Keine Vermögensgegenstände vorhanden</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ersten Vermögensgegenstand anlegen
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pagination.paginatedItems.map(asset => {
              const typeInfo = getTypeInfo(asset.type);
              const Icon = typeInfo.icon;
              return (
                <div key={asset.id} className="glass rounded-xl p-4 hover:bg-secondary/30 transition-colors group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{asset.name}</p>
                          <Badge variant="outline" className="text-xs shrink-0">{typeInfo.label}</Badge>
                        </div>
                        {asset.type === 'immobilie' && asset.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {asset.address}{asset.zip || asset.city ? `, ${asset.zip || ''} ${asset.city || ''}` : ''}
                          </p>
                        )}
                        {asset.type === 'immobilie' && (asset.units || asset.area_sqm) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {asset.units ? `${asset.units} Einheiten` : ''}{asset.units && asset.area_sqm ? ' · ' : ''}{asset.area_sqm ? `${asset.area_sqm} m²` : ''}
                          </p>
                        )}
                        {asset.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{asset.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          {(asset.current_value || asset.purchase_price) && (
                            <p className="text-sm font-semibold text-primary">
                              {formatCurrency(asset.current_value || asset.purchase_price)}
                            </p>
                          )}
                          {asset.purchase_date && (
                            <p className="text-xs text-muted-foreground">
                              Kauf: {new Date(asset.purchase_date).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(asset)}>
                          <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(asset.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
          <PaginationControls
            currentPage={pagination.currentPage} totalPages={pagination.totalPages}
            totalItems={pagination.totalItems} startIndex={pagination.startIndex}
            endIndex={pagination.endIndex} hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage} onNextPage={pagination.nextPage}
            onPrevPage={pagination.prevPage} onGoToPage={pagination.goToPage}
          />
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Vermögensgegenstand bearbeiten' : 'Neuer Vermögensgegenstand'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="z.B. Mietobjekt Hauptstr. 5" />
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={v => updateField('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kaufdatum</Label>
                <Input type="date" value={form.purchase_date} onChange={e => updateField('purchase_date', e.target.value)} />
              </div>
              <div>
                <Label>Kaufpreis (€)</Label>
                <Input value={form.purchase_price} onChange={e => updateField('purchase_price', e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Aktueller Wert (€)</Label>
                <Input value={form.current_value} onChange={e => updateField('current_value', e.target.value)} placeholder="0,00" />
              </div>
            </div>

            {form.type === 'immobilie' && (
              <div className="space-y-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
                <p className="text-sm font-medium">Immobilien-Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Adresse</Label>
                    <Input value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Straße und Hausnummer" />
                  </div>
                  <div>
                    <Label>PLZ</Label>
                    <Input value={form.zip} onChange={e => updateField('zip', e.target.value)} placeholder="12345" />
                  </div>
                  <div>
                    <Label>Stadt</Label>
                    <Input value={form.city} onChange={e => updateField('city', e.target.value)} />
                  </div>
                  <div>
                    <Label>Einheiten</Label>
                    <Input type="number" value={form.units} onChange={e => updateField('units', e.target.value)} placeholder="z.B. 6" />
                  </div>
                  <div>
                    <Label>Fläche (m²)</Label>
                    <Input value={form.area_sqm} onChange={e => updateField('area_sqm', e.target.value)} placeholder="0" />
                  </div>
                </div>
              </div>
            )}

            {form.type !== 'immobilie' && (
              <div>
                <Label>Seriennummer / Kennung</Label>
                <Input value={form.serial_number} onChange={e => updateField('serial_number', e.target.value)} />
              </div>
            )}

            <div>
              <Label>Beschreibung</Label>
              <Input value={form.description} onChange={e => updateField('description', e.target.value)} />
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichert...' : editingAsset ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
