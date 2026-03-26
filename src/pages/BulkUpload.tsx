/**
 * BulkUpload — Massenimport von Belegen, Rechnungen und Kontoauszügen
 *
 * Unterstützt:
 * - Drag & Drop (mehrere Dateien gleichzeitig)
 * - KI-OCR (analyze-receipt Edge Function)
 * - E-Mail-Eingang (Belege per Mail weiterleiten)
 * - Kontoauszug-PDF-Import (parse-bank-pdf Edge Function)
 * - Kamera-Upload (mobile)
 */
import { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Loader2,
  Mail, Inbox, Camera, FileSpreadsheet, Sparkles, ChevronRight,
  ArrowRight, Building2, Info
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface UploadItem {
  id: string;
  file: File;
  type: 'receipt' | 'invoice' | 'bank_statement' | 'contract' | 'other';
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: {
    vendor?: string;
    amount?: number;
    date?: string;
    category?: string;
    document_type?: string;
    confidence?: number;
  };
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.tiff';
const MAX_SIZE_MB = 20;
const MAX_FILES = 50;

function getFileType(file: File): UploadItem['type'] {
  const name = file.name.toLowerCase();
  if (name.includes('rechnung') || name.includes('invoice')) return 'invoice';
  if (name.includes('kontoauszug') || name.includes('statement') || name.includes('umsatz')) return 'bank_statement';
  if (name.includes('vertrag') || name.includes('contract')) return 'contract';
  return 'receipt';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const TYPE_LABELS: Record<UploadItem['type'], string> = {
  receipt: 'Beleg',
  invoice: 'Rechnung',
  bank_statement: 'Kontoauszug',
  contract: 'Vertrag',
  other: 'Sonstiges',
};

const TYPE_COLORS: Record<UploadItem['type'], string> = {
  receipt: 'bg-blue-500/10 text-blue-600',
  invoice: 'bg-green-500/10 text-green-600',
  bank_statement: 'bg-purple-500/10 text-purple-600',
  contract: 'bg-orange-500/10 text-orange-600',
  other: 'bg-gray-500/10 text-gray-600',
};

export default function BulkUpload() {
  const { currentCompany } = useCompany();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const valid = files
      .filter(f => f.size <= MAX_SIZE_MB * 1024 * 1024)
      .slice(0, MAX_FILES - items.length);

    const oversized = files.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} Datei(en) zu groß (max. ${MAX_SIZE_MB} MB)`);
    }

    const newItems: UploadItem[] = valid.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      type: getFileType(f),
      status: 'pending',
      progress: 0,
    }));

    setItems(prev => [...prev, ...newItems]);
  }, [items.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const changeType = useCallback((id: string, type: UploadItem['type']) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, type } : i));
  }, []);

  const processAll = useCallback(async () => {
    if (!currentCompany) {
      toast.error('Bitte zuerst eine Firma auswählen');
      return;
    }
    const pending = items.filter(i => i.status === 'pending');
    if (!pending.length) return;

    setIsProcessing(true);

    for (const item of pending) {
      // Phase 1: Datei hochladen
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'uploading', progress: 15 } : i
      ));

      try {
        // Datei in Supabase Storage hochladen
        const ext = item.file.name.split('.').pop() || 'bin';
        const path = `${currentCompany.id}/${item.type}s/${Date.now()}_${item.file.name}`;
        const { error: storageError } = await supabase.storage
          .from('receipts')
          .upload(path, item.file, { upsert: false });

        if (storageError) throw new Error(storageError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(path);

        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, progress: 40 } : i
        ));

        // Phase 2: KI-Analyse (für Belege, Rechnungen, Kontoauszüge)
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'analyzing', progress: 60 } : i
        ));

        let analysisResult: UploadItem['result'] = {};

        if (item.type === 'bank_statement') {
          // Kontoauszug → parse-bank-pdf Edge Function
          const base64 = await fileToBase64(item.file);
          const { data: parsed } = await supabase.functions.invoke('parse-bank-pdf', {
            body: { pdf: base64, company_id: currentCompany.id },
          });
          if (parsed) {
            analysisResult = {
              document_type: 'Kontoauszug',
              amount: parsed.total_amount,
              date: parsed.statement_date,
              category: `${parsed.transaction_count || 0} Buchungen erkannt`,
              confidence: 90,
            };
          }
        } else {
          // Beleg/Rechnung → analyze-receipt Edge Function
          const base64 = await fileToBase64(item.file);
          const { data: analyzed } = await supabase.functions.invoke('analyze-receipt', {
            body: { image: base64, mediaType: item.file.type || 'image/jpeg' },
          });
          if (analyzed && !analyzed.fallback) {
            analysisResult = {
              vendor: analyzed.vendor,
              amount: analyzed.grossAmount,
              date: analyzed.date,
              category: analyzed.category,
              document_type: item.type === 'invoice' ? 'Rechnung' : 'Beleg',
              confidence: analyzed.confidence,
            };
          }
        }

        // Phase 3: In Datenbank speichern
        if (item.type === 'receipt' || item.type === 'invoice' || item.type === 'other') {
          await supabase.from('receipts').insert({
            company_id: currentCompany.id,
            file_name: item.file.name,
            file_url: publicUrl,
            file_type: item.file.type,
            amount: analysisResult.amount || null,
            date: analysisResult.date || new Date().toISOString().split('T')[0],
            description: analysisResult.vendor || item.file.name,
            category: analysisResult.category || null,
          });
        }

        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done', progress: 100, result: analysisResult } : i
        ));

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Fehler beim Verarbeiten';
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', progress: 0, error: msg } : i
        ));
      }
    }

    setIsProcessing(false);
    const doneCount = items.filter(i => i.status === 'done').length + pending.length;
    toast.success(`${pending.length} Datei(en) erfolgreich verarbeitet`);
  }, [items, currentCompany]);

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);

  // E-Mail-Adresse für Inbox
  const emailInbox = currentCompany
    ? `belege+${currentCompany.id.slice(0, 8)}@fintutto.app`
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            Massenimport
          </h1>
          <p className="text-muted-foreground mt-1">
            Belege, Rechnungen und Kontoauszüge hochladen — KI erkennt alles automatisch
          </p>
        </div>
        {currentCompany && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent px-3 py-1.5 rounded-lg">
            <Building2 className="h-4 w-4" />
            <span>{currentCompany.name}</span>
          </div>
        )}
      </div>

      {/* Kein Unternehmen ausgewählt */}
      {!currentCompany && (
        <div className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">Keine Firma ausgewählt</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">
              Bitte wähle links in der Sidebar eine Firma aus, bevor du Dokumente hochlädst.
            </p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Dateien hochladen
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Per E-Mail
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Kamera
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dateien hochladen */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer select-none ${
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-lg'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/40'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ''; } }}
              className="hidden"
            />
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-colors ${isDragging ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
              <Upload className="h-8 w-8" />
            </div>
            <p className="text-lg font-semibold mb-1">
              {isDragging ? 'Jetzt loslassen!' : 'Dateien hier ablegen'}
            </p>
            <p className="text-muted-foreground text-sm">
              oder klicken zum Auswählen — PDF, JPG, PNG, HEIC bis {MAX_SIZE_MB} MB
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Belege</span>
              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Rechnungen</span>
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Kontoauszüge</span>
              <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> KI-Analyse</span>
            </div>
          </div>

          {/* Datei-Liste */}
          {items.length > 0 && (
            <div className="space-y-3">
              {/* Zusammenfassung */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{items.length} Datei{items.length !== 1 ? 'en' : ''}</span>
                  <span>·</span>
                  <span>{formatSize(totalSize)}</span>
                  {doneCount > 0 && <><span>·</span><span className="text-green-600 font-medium">{doneCount} fertig</span></>}
                  {errorCount > 0 && <><span>·</span><span className="text-destructive font-medium">{errorCount} Fehler</span></>}
                </div>
                <button
                  onClick={() => setItems([])}
                  className="text-muted-foreground hover:text-foreground text-xs"
                  disabled={isProcessing}
                >
                  Alle entfernen
                </button>
              </div>

              {/* Datei-Karten */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className={`rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                    item.status === 'done' ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' :
                    item.status === 'error' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' :
                    'border-border bg-card'
                  }`}>
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <select
                          value={item.type}
                          onChange={e => changeType(item.id, e.target.value as UploadItem['type'])}
                          disabled={item.status !== 'pending'}
                          className="text-xs border rounded px-1 py-0.5 bg-background shrink-0"
                        >
                          {(Object.keys(TYPE_LABELS) as UploadItem['type'][]).map(t => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatSize(item.file.size)}</span>
                        {item.status === 'uploading' && <span className="text-primary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Hochladen...</span>}
                        {item.status === 'analyzing' && <span className="text-primary flex items-center gap-1"><Sparkles className="h-3 w-3 animate-spin" /> KI analysiert...</span>}
                        {item.status === 'done' && item.result && (
                          <span className="text-green-700 dark:text-green-400">
                            {item.result.vendor && `${item.result.vendor}`}
                            {item.result.amount && ` · ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.result.amount)}`}
                            {item.result.confidence && ` · ${item.result.confidence}% Konfidenz`}
                          </span>
                        )}
                        {item.status === 'error' && <span className="text-destructive">{item.error}</span>}
                      </div>
                      {(item.status === 'uploading' || item.status === 'analyzing') && (
                        <Progress value={item.progress} className="h-1 mt-1.5" />
                      )}
                    </div>
                    <div className="shrink-0">
                      {item.status === 'done' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      {item.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                      {(item.status === 'uploading' || item.status === 'analyzing') && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {item.status === 'pending' && (
                        <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-accent rounded-md transition-colors">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload-Button */}
              {pendingCount > 0 && (
                <Button
                  onClick={processAll}
                  disabled={isProcessing || !currentCompany}
                  className="w-full h-11 text-base font-semibold"
                  size="lg"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Wird verarbeitet...</>
                  ) : (
                    <><Sparkles className="h-5 w-5 mr-2" /> {pendingCount} Datei{pendingCount !== 1 ? 'en' : ''} hochladen & KI-Analyse starten</>
                  )}
                </Button>
              )}

              {/* Weiter-Button nach Abschluss */}
              {doneCount > 0 && pendingCount === 0 && !isProcessing && (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setItems([])} className="flex-1">
                    Weitere Dateien hinzufügen
                  </Button>
                  <Button asChild className="flex-1">
                    <a href="/belege">
                      Zu den Belegen <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab: Per E-Mail */}
        <TabsContent value="email" className="mt-4">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                <Inbox className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">E-Mail-Eingang für Belege</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Leite Rechnungen und Belege direkt per E-Mail weiter — die KI liest Betrag, Datum und Kategorie automatisch aus.
                </p>
              </div>
            </div>

            {emailInbox ? (
              <div className="space-y-3">
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Deine persönliche Beleg-E-Mail-Adresse:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono text-primary flex-1">{emailInbox}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(emailInbox); toast.success('Kopiert!'); }}
                      className="text-xs border rounded px-2 py-1 hover:bg-accent transition-colors"
                    >
                      Kopieren
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>Leite Rechnungen von Amazon, OTTO, Lieferanten etc. einfach weiter</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>PDF-Anhänge werden automatisch erkannt und analysiert</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>Belege erscheinen innerhalb von Minuten in deiner Beleg-Liste</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bitte wähle zuerst eine Firma aus.</p>
            )}
          </div>
        </TabsContent>

        {/* Tab: Kamera */}
        <TabsContent value="camera" className="mt-4">
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Beleg fotografieren</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Fotografiere Kassenzettel oder Papierbelege direkt mit der Kamera — KI erkennt Betrag und Kategorie.
                </p>
              </div>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={e => {
                if (e.target.files) {
                  addFiles(Array.from(e.target.files));
                  setActiveTab('upload');
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <Button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full h-12 text-base"
              disabled={!currentCompany}
            >
              <Camera className="h-5 w-5 mr-2" />
              Kamera öffnen
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Funktioniert am besten auf dem Smartphone. Fotos werden direkt zur Upload-Liste hinzugefügt.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tipps */}
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> KI-Analyse erkennt automatisch:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
          <span>✓ Lieferant / Aussteller</span>
          <span>✓ Brutto- und Nettobetrag</span>
          <span>✓ Mehrwertsteuersatz</span>
          <span>✓ Rechnungsdatum</span>
          <span>✓ Buchungskategorie</span>
          <span>✓ Rechnungsnummer</span>
        </div>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}
