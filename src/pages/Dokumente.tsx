/**
 * Dokumente — Zentrales Dokumenten-Management
 *
 * Features:
 * - Alle Dateien aus Supabase Storage (Belege, Rechnungen, Verträge, Sonstiges)
 * - Kategorien, Tags und Freitext-Suche
 * - Upload direkt auf der Seite
 * - Vorschau (PDF, Bild) im Dialog
 * - Download und Löschen
 * - GoBD-konformer Aufbewahrungshinweis
 */
import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Upload, Search, Filter, Download, Trash2, Eye,
  FolderOpen, Tag, Calendar, Building2, X, File, Image,
  FileSpreadsheet, Archive, ChevronDown, Plus, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type DocCategory = 'alle' | 'beleg' | 'rechnung' | 'vertrag' | 'lohn' | 'steuer' | 'sonstiges';

interface DocFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  category: DocCategory;
  tags: string[];
  created_at: string;
  source: 'receipts' | 'invoices' | 'storage';
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  alle: 'Alle',
  beleg: 'Belege',
  rechnung: 'Rechnungen',
  vertrag: 'Verträge',
  lohn: 'Lohnunterlagen',
  steuer: 'Steuerunterlagen',
  sonstiges: 'Sonstiges',
};

const CATEGORY_COLORS: Record<DocCategory, string> = {
  alle: 'bg-primary/20 text-primary',
  beleg: 'bg-blue-500/20 text-blue-400',
  rechnung: 'bg-green-500/20 text-green-400',
  vertrag: 'bg-purple-500/20 text-purple-400',
  lohn: 'bg-orange-500/20 text-orange-400',
  steuer: 'bg-red-500/20 text-red-400',
  sonstiges: 'bg-gray-500/20 text-gray-400',
};

function fileIcon(type: string) {
  if (type.includes('image')) return <Image className="h-5 w-5 text-blue-400" />;
  if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (type.includes('zip') || type.includes('archive'))
    return <Archive className="h-5 w-5 text-yellow-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dokumente() {
  const { currentCompany } = useCompany();
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocCategory>('alle');
  const [previewDoc, setPreviewDoc] = useState<DocFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany) loadDocs();
  }, [currentCompany]);

  const loadDocs = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      // Load receipts
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, file_name, file_url, file_type, file_size, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      // Load invoices with file_url
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, created_at')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const allDocs: DocFile[] = [];

      // Add receipts
      (receipts || []).forEach((r) => {
        if (r.file_url) {
          allDocs.push({
            id: r.id,
            name: r.file_name || 'Beleg',
            size: r.file_size || 0,
            type: r.file_type || 'application/octet-stream',
            url: r.file_url,
            category: 'beleg',
            tags: [],
            created_at: r.created_at,
            source: 'receipts',
          });
        }
      });

      // Add invoice PDFs (virtual entries)
      (invoices || []).forEach((inv) => {
        allDocs.push({
          id: `inv-${inv.id}`,
          name: `Rechnung ${inv.invoice_number || inv.id.slice(0, 8)}`,
          size: 0,
          type: 'application/pdf',
          url: '',
          category: 'rechnung',
          tags: [],
          created_at: inv.created_at,
          source: 'invoices',
        });
      });

      setDocs(allDocs);
    } catch (err) {
      console.error('Dokumente load error:', err);
      toast.error('Fehler beim Laden der Dokumente');
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !currentCompany) return;
    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop();
        const path = `${currentCompany.id}/dokumente/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);

        await supabase.from('receipts').insert({
          company_id: currentCompany.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });

        successCount++;
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Fehler beim Upload: ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} Datei(en) hochgeladen`);
      loadDocs();
    }
    setUploading(false);
  };

  const handleDelete = async (doc: DocFile) => {
    try {
      if (doc.source === 'receipts') {
        await supabase.from('receipts').delete().eq('id', doc.id);
      }
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Dokument gelöscht');
    } catch (err) {
      toast.error('Fehler beim Löschen');
    }
    setDeleteId(null);
  };

  const filtered = docs.filter((d) => {
    const matchSearch = !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === 'alle' || d.category === category;
    return matchSearch && matchCat;
  });

  const categoryCounts = docs.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSize = docs.reduce((s, d) => s + d.size, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Dokumenten-Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {docs.length} Dokumente · {formatBytes(totalSize)} gesamt
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDocs}>
            <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
          </Button>
          <label className="cursor-pointer">
            <Button size="sm" disabled={uploading} asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? 'Lädt hoch...' : 'Hochladen'}
              </span>
            </Button>
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.zip"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['beleg', 'rechnung', 'vertrag', 'steuer'] as DocCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'glass rounded-xl p-4 text-left transition-all hover:scale-[1.02]',
              category === cat ? 'ring-2 ring-primary' : ''
            )}
          >
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
            <p className="text-2xl font-bold mt-1">{categoryCounts[cat] || 0}</p>
          </button>
        ))}
      </div>

      {/* Filter + Suche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Dokument suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                category === cat
                  ? CATEGORY_COLORS[cat]
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              )}
            >
              {CATEGORY_LABELS[cat]}
              {cat !== 'alle' && categoryCounts[cat] ? (
                <span className="ml-1 opacity-70">({categoryCounts[cat]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Dokument-Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground font-medium">Keine Dokumente gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Suchbegriff anpassen oder' : 'Laden Sie Dokumente hoch oder'} wechseln Sie die Kategorie
          </p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-border/30">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors group"
              >
                <div className="flex-shrink-0">{fileIcon(doc.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString('de-DE')}
                    </span>
                    {doc.size > 0 && (
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.size)}</span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', CATEGORY_COLORS[doc.category])}>
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.url && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {doc.source === 'receipts' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-500"
                      onClick={() => setDeleteId(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GoBD-Hinweis */}
      <div className="glass rounded-xl p-4 border border-yellow-500/20">
        <div className="flex items-start gap-3">
          <Archive className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">GoBD-Aufbewahrungspflicht</p>
            <p className="text-xs text-muted-foreground mt-1">
              Steuerlich relevante Dokumente (Rechnungen, Belege, Verträge) müssen nach § 147 AO
              mindestens <strong>10 Jahre</strong> aufbewahrt werden. Buchungsbelege 10 Jahre,
              Handels- und Geschäftsbriefe 6 Jahre. Alle Dokumente sind unveränderbar zu archivieren.
            </p>
          </div>
        </div>
      </div>

      {/* Vorschau-Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc && fileIcon(previewDoc.type)}
              {previewDoc?.name}
            </DialogTitle>
            <DialogDescription>
              {previewDoc && new Date(previewDoc.created_at).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'long', year: 'numeric'
              })}
              {previewDoc?.size ? ` · ${formatBytes(previewDoc.size)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {previewDoc?.url && (
            <div className="flex-1 overflow-hidden rounded-lg">
              {previewDoc.type.includes('image') ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-[70vh] object-contain mx-auto" />
              ) : previewDoc.type.includes('pdf') ? (
                <iframe src={previewDoc.url} className="w-full h-[70vh] rounded-lg" title={previewDoc.name} />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <File className="h-12 w-12 mb-3 opacity-50" />
                  <p>Vorschau nicht verfügbar</p>
                  <Button className="mt-3" onClick={() => window.open(previewDoc.url, '_blank')}>
                    <Download className="h-4 w-4 mr-2" /> Herunterladen
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Das Dokument wird dauerhaft gelöscht.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const doc = docs.find((d) => d.id === deleteId);
                if (doc) handleDelete(doc);
              }}
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
