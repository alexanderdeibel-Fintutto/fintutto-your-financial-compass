/**
 * TaxAdvisorDocuments – Dokumenten-Übergabe an Steuerberater
 *
 * Ermöglicht das strukturierte Bereitstellen von:
 * - DATEV-Export (EXTF)
 * - GdPDU/GoBD-Paket
 * - Berichte (BWA, GuV, Bilanz)
 * - Belege (ZIP)
 * - Individuelle Dokumente
 */

import { useState, useCallback, useEffect } from 'react';
import {
  FileText, Download, Upload, CheckCircle, Clock, Trash2,
  Plus, FolderOpen, Send, Eye, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface AdvisorDocument {
  id: string;
  company_id: string;
  title: string;
  document_type: string;
  period: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: 'pending' | 'shared' | 'reviewed' | 'approved';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface AdvisorComment {
  id: string;
  document_id: string;
  author: string;
  author_type: 'client' | 'advisor';
  message: string;
  created_at: string;
}

const DOC_TYPES = [
  { value: 'datev_export', label: 'DATEV-Export (EXTF)', icon: '📊' },
  { value: 'gdpdu_export', label: 'GdPDU/GoBD-Paket', icon: '📦' },
  { value: 'bwa', label: 'Betriebswirtschaftliche Auswertung', icon: '📈' },
  { value: 'guv', label: 'Gewinn- und Verlustrechnung', icon: '💹' },
  { value: 'bilanz', label: 'Bilanz', icon: '⚖️' },
  { value: 'ustva', label: 'UStVA-Unterlagen', icon: '🏛️' },
  { value: 'receipts', label: 'Belegsammlung (ZIP)', icon: '🧾' },
  { value: 'contracts', label: 'Verträge', icon: '📋' },
  { value: 'other', label: 'Sonstiges', icon: '📄' },
];

const STATUS_CONFIG = {
  pending: { label: 'Ausstehend', color: 'bg-secondary text-secondary-foreground' },
  shared: { label: 'Geteilt', color: 'bg-info/20 text-info' },
  reviewed: { label: 'Geprüft', color: 'bg-warning/20 text-warning' },
  approved: { label: 'Freigegeben', color: 'bg-success/20 text-success' },
};

const fmt = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export function TaxAdvisorDocuments() {
  const { currentCompany } = useCompany();
  const [documents, setDocuments] = useState<AdvisorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<AdvisorDocument | null>(null);
  const [comments, setComments] = useState<AdvisorComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('datev_export');
  const [formPeriod, setFormPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formNotes, setFormNotes] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from('advisor_documents')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleCreate = async () => {
    if (!currentCompany || !formTitle || !formType) return;
    const typeInfo = DOC_TYPES.find((t) => t.value === formType);
    const { error } = await supabase.from('advisor_documents').insert({
      company_id: currentCompany.id,
      title: formTitle || typeInfo?.label,
      document_type: formType,
      period: formPeriod,
      notes: formNotes,
      status: 'pending',
    });
    if (error) { toast.error('Fehler beim Erstellen'); return; }
    toast.success('Dokument erstellt');
    setDialogOpen(false);
    resetForm();
    fetchDocuments();
  };

  const handleStatusChange = async (id: string, status: AdvisorDocument['status']) => {
    const { error } = await supabase.from('advisor_documents').update({ status }).eq('id', id);
    if (error) { toast.error('Fehler beim Aktualisieren'); return; }
    toast.success(`Status auf "${STATUS_CONFIG[status].label}" gesetzt`);
    fetchDocuments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('advisor_documents').delete().eq('id', id);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    toast.success('Dokument gelöscht');
    fetchDocuments();
  };

  const openComments = async (doc: AdvisorDocument) => {
    setSelectedDoc(doc);
    const { data } = await supabase
      .from('advisor_comments')
      .select('*')
      .eq('document_id', doc.id)
      .order('created_at');
    setComments(data || []);
    setCommentDialogOpen(true);
  };

  const handleAddComment = async () => {
    if (!selectedDoc || !newComment.trim()) return;
    const { error } = await supabase.from('advisor_comments').insert({
      document_id: selectedDoc.id,
      author: currentCompany?.name || 'Mandant',
      author_type: 'client',
      message: newComment.trim(),
    });
    if (error) { toast.error('Fehler beim Senden'); return; }
    setNewComment('');
    const { data } = await supabase
      .from('advisor_comments')
      .select('*')
      .eq('document_id', selectedDoc.id)
      .order('created_at');
    setComments(data || []);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormType('datev_export');
    setFormNotes('');
  };

  const pendingCount = documents.filter((d) => d.status === 'pending').length;
  const sharedCount = documents.filter((d) => d.status === 'shared').length;
  const approvedCount = documents.filter((d) => d.status === 'approved').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><FolderOpen className="h-5 w-5 text-primary" /></div>
          <div>
            <h3 className="font-semibold">Dokumenten-Übergabe</h3>
            <p className="text-xs text-muted-foreground">Strukturierte Bereitstellung für den Steuerberater</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Dokument
        </Button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Ausstehend</p>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-info">{sharedCount}</p>
          <p className="text-xs text-muted-foreground">Geteilt</p>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{approvedCount}</p>
          <p className="text-xs text-muted-foreground">Freigegeben</p>
        </div>
      </div>

      {/* Dokument-Liste */}
      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Laden...</div>
      ) : documents.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-3">Noch keine Dokumente bereitgestellt</p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Erstes Dokument erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const typeInfo = DOC_TYPES.find((t) => t.value === doc.document_type);
            const statusCfg = STATUS_CONFIG[doc.status];
            return (
              <div key={doc.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{typeInfo?.icon || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{doc.title}</p>
                        <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeInfo?.label} · Zeitraum: {doc.period}
                      </p>
                      {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(doc.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openComments(doc)} title="Kommentare">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    {doc.status === 'pending' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-info" onClick={() => handleStatusChange(doc.id, 'shared')} title="Teilen">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {doc.status === 'shared' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => handleStatusChange(doc.id, 'approved')} title="Freigeben">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(doc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Neues Dokument Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dokument bereitstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Dokumenttyp *</Label>
              <Select value={formType} onValueChange={(v) => {
                setFormType(v);
                const t = DOC_TYPES.find((d) => d.value === v);
                if (t && !formTitle) setFormTitle(t.label);
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titel *</Label>
              <Input className="mt-1" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. BWA Januar 2026" />
            </div>
            <div>
              <Label>Zeitraum</Label>
              <Input className="mt-1" type="month" value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} />
            </div>
            <div>
              <Label>Notizen für Steuerberater</Label>
              <Textarea className="mt-1" rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Hinweise, Besonderheiten..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreate}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kommentar-Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <MessageSquare className="inline h-4 w-4 mr-2" />
              Kommentare: {selectedDoc?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto py-2">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Noch keine Kommentare</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg text-sm ${c.author_type === 'advisor' ? 'bg-primary/10 ml-4' : 'bg-secondary/50 mr-4'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs">{c.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p>{c.message}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Kommentar eingeben..."
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            />
            <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
