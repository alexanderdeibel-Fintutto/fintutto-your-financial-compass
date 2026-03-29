import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, FileText, TrendingUp, TrendingDown, QrCode,
  Edit, Trash2, ChevronDown, Download, Filter, X, Check,
  AlertCircle, Clock, CheckCircle, Ban, FileCheck
} from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import { InvoicePaymentPortal } from '@/components/invoices/InvoicePaymentPortal';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface Invoice {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  amount: number;
  due_date: string | null;
  issue_date: string;
  description: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  tax_rate?: number | null;
  notes?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Entwurf',    color: 'bg-muted text-muted-foreground',    icon: FileText },
  sent:      { label: 'Versendet',  color: 'bg-blue-500/20 text-blue-400',      icon: Clock },
  paid:      { label: 'Bezahlt',    color: 'bg-green-500/20 text-green-400',    icon: CheckCircle },
  overdue:   { label: 'Überfällig', color: 'bg-red-500/20 text-red-400',        icon: AlertCircle },
  cancelled: { label: 'Storniert',  color: 'bg-muted text-muted-foreground',    icon: Ban },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  outgoing: { label: 'Ausgangsrechnung', color: 'bg-primary/20 text-primary' },
  incoming: { label: 'Eingangsrechnung', color: 'bg-orange-500/20 text-orange-400' },
  credit:   { label: 'Gutschrift',       color: 'bg-purple-500/20 text-purple-400' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['paid', 'overdue', 'cancelled'],
  overdue:   ['paid', 'cancelled'],
  paid:      [],
  cancelled: [],
};

export default function Invoices() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [portalInvoice, setPortalInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (currentCompany) fetchInvoices();
  }, [currentCompany]);

  const fetchInvoices = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('issue_date', { ascending: false })
      .limit(10000);
    if (data) setInvoices(data);
    setLoading(false);
  }, [currentCompany]);

  const handleStatusChange = async (invoice: Invoice, newStatus: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoice.id);
    if (error) {
      toast({ title: 'Fehler', description: 'Status konnte nicht geändert werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Status geändert', description: `Rechnung ${invoice.invoice_number} ist jetzt ${statusConfig[newStatus]?.label}.` });
      fetchInvoices();
    }
  };

  const handleDelete = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    const { error } = await supabase.from('invoices').delete().eq('id', deleteInvoice.id);
    if (error) {
      toast({ title: 'Fehler', description: 'Rechnung konnte nicht gelöscht werden.', variant: 'destructive' });
    } else {
      toast({ title: 'Gelöscht', description: `Rechnung ${deleteInvoice.invoice_number} wurde gelöscht.` });
      fetchInvoices();
    }
    setDeleting(false);
    setDeleteInvoice(null);
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    // Generate simple text-based PDF representation as CSV for now
    const lines = [
      `RECHNUNG ${invoice.invoice_number}`,
      `Datum: ${formatDate(invoice.issue_date)}`,
      `Fällig: ${formatDate(invoice.due_date)}`,
      `Kunde: ${invoice.contact_name || '-'}`,
      `Beschreibung: ${invoice.description || '-'}`,
      `Betrag: ${formatCurrency(invoice.amount)}`,
      `Status: ${statusConfig[invoice.status]?.label || invoice.status}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rechnung_${invoice.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download gestartet', description: `Rechnung ${invoice.invoice_number} wird heruntergeladen.` });
  };

  const handleExportCSV = () => {
    const headers = ['Rechnungsnummer', 'Typ', 'Status', 'Kunde', 'Betrag', 'Ausstellungsdatum', 'Fälligkeitsdatum', 'Beschreibung'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      typeConfig[inv.type]?.label || inv.type,
      statusConfig[inv.status]?.label || inv.status,
      inv.contact_name || '',
      inv.amount.toFixed(2),
      formatDate(inv.issue_date),
      formatDate(inv.due_date),
      inv.description || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rechnungen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportiert', description: `${filteredInvoices.length} Rechnungen exportiert.` });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.contact_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'all' || inv.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const pagination = usePagination(filteredInvoices);

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const openAmount = invoices.filter((inv) => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;
  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

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
          <h1 className="text-3xl font-bold mb-2">Rechnungen</h1>
          <p className="text-muted-foreground">
            {invoices.length} Rechnungen
            {overdueCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">• {overdueCount} überfällig</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            CSV Export
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Rechnung
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamt</p>
              <p className="text-2xl font-bold">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamtvolumen</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bezahlt</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(paidAmount)}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${overdueCount > 0 ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
              <TrendingDown className={`h-5 w-5 ${overdueCount > 0 ? 'text-red-400' : 'text-orange-400'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Offen / Überfällig</p>
              <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-400' : 'text-orange-400'}`}>
                {formatCurrency(openAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechnung, Kunde oder Beschreibung suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={activeFilters > 0 ? 'border-primary text-primary' : ''}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filter
          {activeFilters > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
              {activeFilters}
            </Badge>
          )}
        </Button>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }}>
            <X className="mr-2 h-4 w-4" />
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Typ</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder="Alle Typen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-end">
            <p className="text-sm text-muted-foreground">
              {filteredInvoices.length} von {invoices.length} Rechnungen angezeigt
            </p>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-secondary/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary/50 rounded w-1/4" />
                  <div className="h-3 bg-secondary/50 rounded w-1/3" />
                </div>
                <div className="h-6 w-20 bg-secondary/50 rounded-full" />
                <div className="h-5 w-24 bg-secondary/50 rounded" />
              </div>
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Keine Rechnungen gefunden</p>
            <p className="text-sm mt-1">
              {invoices.length === 0
                ? 'Erstellen Sie Ihre erste Rechnung.'
                : 'Passen Sie die Suchfilter an.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pagination.paginatedItems.map((invoice) => {
              const statusCfg = statusConfig[invoice.status] || statusConfig.draft;
              const typeCfg = typeConfig[invoice.type] || typeConfig.outgoing;
              const StatusIcon = statusCfg.icon;
              const transitions = STATUS_TRANSITIONS[invoice.status] || [];

              return (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <Badge className={`text-xs ${typeCfg.color}`}>{typeCfg.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {invoice.contact_name || 'Kein Kunde'} • {invoice.description || 'Keine Beschreibung'} • Fällig: {formatDate(invoice.due_date)}
                    </p>
                  </div>

                  {/* Status Badge with dropdown for transitions */}
                  {transitions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className={`h-7 px-2 rounded-full text-xs font-medium ${statusCfg.color} hover:opacity-80`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">Status ändern auf:</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {transitions.map((s) => {
                          const cfg = statusConfig[s];
                          const Icon = cfg.icon;
                          return (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(invoice, s)}>
                              <Icon className="h-4 w-4 mr-2" />
                              {cfg.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge className={`text-xs ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusCfg.label}
                    </Badge>
                  )}

                  <span className="font-semibold shrink-0">{formatCurrency(invoice.amount)}</span>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-primary hover:bg-primary/10"
                        title="Zahlungsportal"
                        onClick={() => setPortalInvoice(invoice)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-secondary"
                      title="PDF herunterladen"
                      onClick={() => handleDownloadPDF(invoice)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-secondary"
                      title="Bearbeiten"
                      onClick={() => setEditInvoice(invoice)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                      title="Löschen"
                      onClick={() => setDeleteInvoice(invoice)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          hasNextPage={pagination.hasNextPage}
          hasPrevPage={pagination.hasPrevPage}
          onNextPage={pagination.nextPage}
          onPrevPage={pagination.prevPage}
          onGoToPage={pagination.goToPage}
        />
      </div>

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchInvoices}
      />

      {/* Edit Invoice Dialog – reuse CreateInvoiceDialog with prefilled data */}
      {editInvoice && (
        <CreateInvoiceDialog
          open={!!editInvoice}
          onOpenChange={(open) => { if (!open) setEditInvoice(null); }}
          onSuccess={() => { fetchInvoices(); setEditInvoice(null); }}
          editData={editInvoice}
        />
      )}

      {/* Payment Portal */}
      {portalInvoice && (
        <InvoicePaymentPortal
          invoice={portalInvoice}
          companyName={currentCompany?.name || ''}
          open={!!portalInvoice}
          onClose={() => setPortalInvoice(null)}
          onStatusChange={fetchInvoices}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInvoice} onOpenChange={(open) => { if (!open) setDeleteInvoice(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Rechnung <strong>{deleteInvoice?.invoice_number}</strong> ({formatCurrency(deleteInvoice?.amount || 0)}) wird unwiderruflich gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Löschen...' : 'Endgültig löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
