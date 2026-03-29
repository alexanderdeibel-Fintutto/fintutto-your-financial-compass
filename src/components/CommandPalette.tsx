import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard, FileText, Receipt, Users, BookOpen, PlusCircle,
  Upload, Settings, HelpCircle, Building2, CreditCard, BarChart3,
  Calculator, Moon, Sun, Monitor, TrendingUp, TrendingDown, Bot,
  Gauge, Zap, Calendar, QrCode, ArrowRight,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewBooking?: () => void;
  onNewInvoice?: () => void;
  onUploadReceipt?: () => void;
}

interface CmdItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette({
  open, onOpenChange, onNewBooking, onNewInvoice, onUploadReceipt,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { currentCompany } = useCompany();
  const [quickMode, setQuickMode] = useState<null | 'income' | 'expense'>(null);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDesc, setQuickDesc] = useState('');

  const close = useCallback(() => {
    onOpenChange(false);
    setQuickMode(null);
    setQuickAmount('');
    setQuickDesc('');
  }, [onOpenChange]);

  const handleQuickBooking = useCallback(async (type: 'income' | 'expense') => {
    if (!currentCompany || !quickAmount) { toast.error('Bitte Betrag eingeben'); return; }
    const amount = parseFloat(quickAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { toast.error('Ungültiger Betrag'); return; }
    const { error } = await supabase.from('transactions').insert({
      company_id: currentCompany.id,
      type,
      amount,
      description: quickDesc || (type === 'income' ? 'Schnellbuchung Einnahme' : 'Schnellbuchung Ausgabe'),
      category: type === 'income' ? 'Sonstige Einnahmen' : 'Sonstige Ausgaben',
      date: new Date().toISOString().split('T')[0],
    });
    if (error) { toast.error('Fehler beim Speichern'); return; }
    toast.success(`${type === 'income' ? 'Einnahme' : 'Ausgabe'} von ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)} gespeichert`);
    close();
  }, [currentCompany, quickAmount, quickDesc, close]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpenChange(!open); }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Reset quick mode when dialog closes
  useEffect(() => {
    if (!open) { setQuickMode(null); setQuickAmount(''); setQuickDesc(''); }
  }, [open]);

  const nav = (path: string) => { navigate(path); close(); };

  const quickActions: CmdItem[] = [
    { id: 'quick-income', label: 'Einnahme schnell buchen', icon: TrendingUp, shortcut: '⌘+', action: () => setQuickMode('income'), keywords: ['einnahme', 'income', '+'] },
    { id: 'quick-expense', label: 'Ausgabe schnell buchen', icon: TrendingDown, shortcut: '⌘-', action: () => setQuickMode('expense'), keywords: ['ausgabe', 'expense', '-'] },
    { id: 'new-booking', label: 'Neue Buchung erstellen', icon: PlusCircle, shortcut: '⌘N', action: () => { close(); onNewBooking?.(); }, keywords: ['create', 'neu'] },
    { id: 'new-invoice', label: 'Neue Rechnung erstellen', icon: FileText, shortcut: '⌘I', action: () => { close(); onNewInvoice?.(); }, keywords: ['rechnung schreiben'] },
    { id: 'upload-receipt', label: 'Beleg hochladen', icon: Upload, shortcut: '⌘U', action: () => { close(); onUploadReceipt?.(); }, keywords: ['upload', 'scan'] },
  ];

  const navCommands: CmdItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌥D', action: () => nav('/'), keywords: ['home', 'übersicht'] },
    { id: 'cockpit', label: 'Finanz-Cockpit', icon: Gauge, action: () => nav('/cockpit'), keywords: ['liquidität', 'steuer'] },
    { id: 'kapital', label: 'Kapitalverwaltung', icon: Building2, action: () => nav('/kapital'), keywords: ['depot', 'vermögen', 'wertpapiere'] },
    { id: 'ki', label: 'KI-Assistent', icon: Bot, action: () => nav('/ki-assistent'), keywords: ['ai', 'gpt', 'assistent'] },
    { id: 'buchungen', label: 'Buchungen', icon: BookOpen, shortcut: '⌥B', action: () => nav('/buchungen'), keywords: ['transaktionen'] },
    { id: 'rechnungen', label: 'Rechnungen', icon: FileText, shortcut: '⌥R', action: () => nav('/rechnungen'), keywords: ['invoices'] },
    { id: 'belege', label: 'Belege', icon: Receipt, shortcut: '⌥E', action: () => nav('/belege'), keywords: ['receipts', 'dokumente'] },
    { id: 'kontakte', label: 'Kontakte', icon: Users, shortcut: '⌥K', action: () => nav('/kontakte'), keywords: ['kunden', 'lieferanten'] },
    { id: 'kalender', label: 'Kalender', icon: Calendar, action: () => nav('/kalender'), keywords: ['termine', 'events'] },
    { id: 'elster', label: 'ELSTER / UStVA', icon: Zap, action: () => nav('/elster'), keywords: ['steuer', 'ustva'] },
    { id: 'berichte', label: 'Berichte', icon: BarChart3, action: () => nav('/berichte'), keywords: ['bwa', 'bilanz', 'guv'] },
    { id: 'konten', label: 'Kontenplan', icon: Calculator, action: () => nav('/konten'), keywords: ['skr03'] },
    { id: 'bank', label: 'Bankkonten', icon: CreditCard, action: () => nav('/bank'), keywords: ['finapi'] },
    { id: 'firmen', label: 'Firmen', icon: Building2, action: () => nav('/firmen'), keywords: ['mandanten'] },
    { id: 'einstellungen', label: 'Einstellungen', icon: Settings, action: () => nav('/einstellungen'), keywords: ['datev', 'export'] },
  ];

  const themeCommands: CmdItem[] = [
    { id: 'theme-light', label: 'Heller Modus', icon: Sun, action: () => setTheme('light'), keywords: ['hell', 'tag'] },
    { id: 'theme-dark', label: 'Dunkler Modus', icon: Moon, action: () => setTheme('dark'), keywords: ['dunkel', 'nacht'] },
    { id: 'theme-system', label: 'System-Theme', icon: Monitor, action: () => setTheme('system'), keywords: ['auto', 'automatisch'] },
  ];

  const helpCommands: CmdItem[] = [
    { id: 'help', label: 'Hilfe & Support', icon: HelpCircle, action: () => nav('/hilfe'), keywords: ['faq'] },
  ];

  const renderGroup = (heading: string, items: CmdItem[]) => (
    <CommandGroup heading={heading}>
      {items.map((cmd) => (
        <CommandItem key={cmd.id} onSelect={() => { cmd.action(); }} keywords={cmd.keywords} className="gap-2 cursor-pointer">
          <cmd.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{cmd.label}</span>
          {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
          {((cmd.id === 'theme-light' && theme === 'light') ||
            (cmd.id === 'theme-dark' && theme === 'dark') ||
            (cmd.id === 'theme-system' && theme === 'system')) && (
            <span className="text-xs text-primary">Aktiv</span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {quickMode ? (
        <div className="p-4 space-y-3">
          <div className={`flex items-center gap-2 text-sm font-semibold ${quickMode === 'income' ? 'text-green-500' : 'text-red-500'}`}>
            {quickMode === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            Schnell-{quickMode === 'income' ? 'Einnahme' : 'Ausgabe'}
          </div>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder="Betrag (z.B. 150,00)"
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
            className="w-full px-3 py-2 text-2xl font-bold bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickBooking(quickMode);
              if (e.key === 'Escape') setQuickMode(null);
            }}
          />
          <input
            type="text"
            placeholder="Beschreibung (optional)"
            value={quickDesc}
            onChange={(e) => setQuickDesc(e.target.value)}
            className="w-full px-3 py-2 bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickBooking(quickMode);
              if (e.key === 'Escape') setQuickMode(null);
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickBooking(quickMode)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white ${quickMode === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              Speichern (Enter)
            </button>
            <button onClick={() => setQuickMode(null)} className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80">
              Zurück (Esc)
            </button>
          </div>
        </div>
      ) : (
        <>
          <CommandInput placeholder="Suche nach Seiten, Aktionen... (⌘K)" />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            {renderGroup('Schnellaktionen', quickActions)}
            <CommandSeparator />
            {renderGroup('Navigation', navCommands)}
            <CommandSeparator />
            {renderGroup('Darstellung', themeCommands)}
            <CommandSeparator />
            {renderGroup('Hilfe', helpCommands)}
          </CommandList>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">↑↓</kbd> Navigieren</span>
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">↵</kbd> Auswählen</span>
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded">Esc</kbd> Schließen</span>
          </div>
        </>
      )}
    </CommandDialog>
  );
}
