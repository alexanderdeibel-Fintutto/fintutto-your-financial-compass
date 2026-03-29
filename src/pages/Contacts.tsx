import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Users, Mail, Phone, MapPin, Edit, Trash2,
  Upload, Download, MoreHorizontal, Building2, User, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'both';
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  iban: string | null;
  notes: string | null;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  customer: 'Kunde',
  supplier: 'Lieferant',
  both: 'Kunde & Lieferant',
};

const typeColors: Record<string, string> = {
  customer: 'bg-blue-500/20 text-blue-400',
  supplier: 'bg-orange-500/20 text-orange-400',
  both: 'bg-purple-500/20 text-purple-400',
};

const emptyForm = {
  name: '',
  type: 'customer' as Contact['type'],
  email: '',
  phone: '',
  address: '',
  tax_id: '',
  iban: '',
  notes: '',
};

export default function Contacts() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany) fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const fetchContacts = async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('contacts').select('*')
      .eq('company_id', currentCompany.id).order('name');
    if (data) setContacts(data as Contact[]);
    setLoading(false);
  };

  const resetForm = () => { setFormData(emptyForm); setSelectedContact(null); };

  const handleOpenDialog = (contact?: Contact) => {
    if (contact) {
      setSelectedContact(contact);
      setFormData({
        name: contact.name, type: contact.type,
        email: contact.email || '', phone: contact.phone || '',
        address: contact.address || '', tax_id: contact.tax_id || '',
        iban: contact.iban || '', notes: contact.notes || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany || !formData.name.trim()) {
      toast({ title: 'Fehler', description: 'Name ist ein Pflichtfeld.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      company_id: currentCompany.id, name: formData.name.trim(), type: formData.type,
      email: formData.email || null, phone: formData.phone || null,
      address: formData.address || null, tax_id: formData.tax_id || null,
      iban: formData.iban || null, notes: formData.notes || null,
    };
    let error;
    if (selectedContact) {
      ({ error } = await supabase.from('contacts').update(payload).eq('id', selectedContact.id));
    } else {
      ({ error } = await supabase.from('contacts').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Erfolg', description: selectedContact ? 'Kontakt aktualisiert.' : 'Kontakt erstellt.' });
    setDialogOpen(false); resetForm(); fetchContacts();
  };

  const handleDelete = async () => {
    if (!selectedContact) return;
    const { error } = await supabase.from('contacts').delete().eq('id', selectedContact.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Erfolg', description: 'Kontakt gelöscht.' });
    setDeleteDialogOpen(false); setSelectedContact(null); fetchContacts();
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Typ', 'E-Mail', 'Telefon', 'Adresse', 'Steuernummer', 'IBAN', 'Notizen'];
    const rows = filteredContacts.map((c) => [
      c.name, typeLabels[c.type] || c.type, c.email || '', c.phone || '',
      c.address || '', c.tax_id || '', c.iban || '', c.notes || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Kontakte_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentCompany || !e.target.files?.[0]) return;
    const text = await e.target.files[0].text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      toast({ title: 'Fehler', description: 'Leere CSV-Datei.', variant: 'destructive' });
      return;
    }
    const records = lines.slice(1).map((line) => {
      const cols = line.split(';').map((c) => c.replace(/^"|"$/g, '').trim());
      return {
        company_id: currentCompany.id, name: cols[0] || 'Unbekannt',
        type: (cols[1] === 'Lieferant' ? 'supplier' : cols[1] === 'Kunde & Lieferant' ? 'both' : 'customer') as Contact['type'],
        email: cols[2] || null, phone: cols[3] || null, address: cols[4] || null,
        tax_id: cols[5] || null, iban: cols[6] || null, notes: cols[7] || null,
      };
    }).filter((r) => r.name && r.name !== 'Unbekannt');
    if (records.length === 0) {
      toast({ title: 'Fehler', description: 'Keine gültigen Datensätze.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('contacts').insert(records);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Import erfolgreich', description: `${records.length} Kontakte importiert.` });
      fetchContacts();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: contacts.length,
    customers: contacts.filter((c) => c.type === 'customer' || c.type === 'both').length,
    suppliers: contacts.filter((c) => c.type === 'supplier' || c.type === 'both').length,
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Kontakte</h1>
          <p className="text-muted-foreground">Kunden und Lieferanten verwalten</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />CSV Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredContacts.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />Neuer Kontakt
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, value: stats.total, label: 'Gesamt', color: 'text-muted-foreground' },
          { icon: User, value: stats.customers, label: 'Kunden', color: 'text-blue-400' },
          { icon: Building2, value: stats.suppliers, label: 'Lieferanten', color: 'text-orange-400' },
        ].map(({ icon: Icon, value, label, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 ${color}`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name, E-Mail oder Telefon suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="customer">Kunden</SelectItem>
            <SelectItem value="supplier">Lieferanten</SelectItem>
            <SelectItem value="both">Kunde & Lieferant</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={fetchContacts} title="Aktualisieren">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Contact List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Kontakte...</div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Users className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Keine Kontakte gefunden</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || typeFilter !== 'all'
                  ? 'Andere Suchbegriffe oder Filter versuchen.'
                  : 'Erstellen Sie Ihren ersten Kontakt.'}
              </p>
            </div>
            {!searchQuery && typeFilter === 'all' && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />Ersten Kontakt erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{contact.name}</span>
                      <Badge className={`text-xs ${typeColors[contact.type] || ''}`}>
                        {typeLabels[contact.type] || contact.type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />{contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{contact.phone}
                        </span>
                      )}
                      {contact.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{contact.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(contact)}>
                        <Edit className="mr-2 h-4 w-4" />Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { setSelectedContact(contact); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</DialogTitle>
            <DialogDescription>
              {selectedContact ? 'Kontaktdaten aktualisieren.' : 'Neuen Kunden oder Lieferanten anlegen.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Max Mustermann / Musterfirma GmbH"
                />
              </div>
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as Contact['type'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Kunde</SelectItem>
                    <SelectItem value="supplier">Lieferant</SelectItem>
                    <SelectItem value="both">Kunde & Lieferant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kontakt@beispiel.de"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+49 89 12345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Steuernummer / USt-IdNr.</Label>
                <Input
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="DE123456789"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Adresse</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Musterstraße 1, 80331 München"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>IBAN</Label>
                <Input
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="font-mono"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notizen</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Interne Notizen..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern...' : selectedContact ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie <strong>{selectedContact?.name}</strong> wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
