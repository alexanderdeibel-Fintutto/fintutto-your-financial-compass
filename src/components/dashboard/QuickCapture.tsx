/**
 * QuickCapture – Schnellerfassung via Keyboard Shortcut (Ctrl+K / Cmd+K)
 *
 * Ermöglicht das schnelle Erfassen von:
 * - Buchungen (Einnahmen / Ausgaben)
 * - Rechnungen
 * - Belegen
 *
 * Öffnet sich mit Ctrl+K / Cmd+K von überall in der App.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import {
  Plus, TrendingUp, TrendingDown, FileText, Receipt, CreditCard,
  BarChart3, Users, Calendar, Settings, Search, Zap, ArrowRight,
  Building2, Bot, Gauge,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  group: string;
}

interface QuickCaptureProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickCapture({ open: controlledOpen, onOpenChange }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [mode, setMode] = useState<'search' | 'income' | 'expense'>('search');
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : open;
  const setIsOpen = onOpenChange || setOpen;

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  const handleQuickBooking = useCallback(async (type: 'income' | 'expense') => {
    if (!currentCompany || !quickAmount) {
      toast.error('Bitte Betrag eingeben');
      return;
    }
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
    setQuickAmount('');
    setQuickDesc('');
    setMode('search');
    setIsOpen(false);
  }, [currentCompany, quickAmount, quickDesc, setIsOpen]);

  const actions: QuickAction[] = [
    // Quick Booking
    {
      id: 'quick-income',
      label: 'Einnahme buchen',
      description: 'Schnell eine Einnahme erfassen',
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
      action: () => setMode('income'),
      keywords: ['einnahme', 'income', 'umsatz', '+'],
      group: 'Schnellerfassung',
    },
    {
      id: 'quick-expense',
      label: 'Ausgabe buchen',
      description: 'Schnell eine Ausgabe erfassen',
      icon: <TrendingDown className="h-4 w-4 text-red-500" />,
      action: () => setMode('expense'),
      keywords: ['ausgabe', 'expense', 'kosten', '-'],
      group: 'Schnellerfassung',
    },
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => { navigate('/'); setIsOpen(false); },
      group: 'Navigation',
    },
    {
      id: 'nav-invoices',
      label: 'Rechnungen',
      icon: <FileText className="h-4 w-4" />,
      action: () => { navigate('/rechnungen'); setIsOpen(false); },
      keywords: ['rechnung', 'invoice'],
      group: 'Navigation',
    },
    {
      id: 'nav-transactions',
      label: 'Buchungen',
      icon: <CreditCard className="h-4 w-4" />,
      action: () => { navigate('/buchungen'); setIsOpen(false); },
      keywords: ['buchung', 'transaktion', 'transaction'],
      group: 'Navigation',
    },
    {
      id: 'nav-receipts',
      label: 'Belege',
      icon: <Receipt className="h-4 w-4" />,
      action: () => { navigate('/belege'); setIsOpen(false); },
      keywords: ['beleg', 'receipt'],
      group: 'Navigation',
    },
    {
      id: 'nav-contacts',
      label: 'Kontakte',
      icon: <Users className="h-4 w-4" />,
      action: () => { navigate('/kontakte'); setIsOpen(false); },
      keywords: ['kontakt', 'kunde', 'lieferant'],
      group: 'Navigation',
    },
    {
      id: 'nav-calendar',
      label: 'Kalender',
      icon: <Calendar className="h-4 w-4" />,
      action: () => { navigate('/kalender'); setIsOpen(false); },
      group: 'Navigation',
    },
    {
      id: 'nav-cockpit',
      label: 'Finanz-Cockpit',
      icon: <Gauge className="h-4 w-4" />,
      action: () => { navigate('/cockpit'); setIsOpen(false); },
      keywords: ['cockpit', 'liquidität'],
      group: 'Navigation',
    },
    {
      id: 'nav-kapital',
      label: 'Kapitalverwaltung',
      icon: <Building2 className="h-4 w-4" />,
      action: () => { navigate('/kapital'); setIsOpen(false); },
      keywords: ['kapital', 'depot', 'vermögen'],
      group: 'Navigation',
    },
    {
      id: 'nav-ai',
      label: 'KI-Assistent',
      icon: <Bot className="h-4 w-4" />,
      action: () => { navigate('/ki-assistent'); setIsOpen(false); },
      keywords: ['ki', 'ai', 'assistent', 'gpt'],
      group: 'Navigation',
    },
    {
      id: 'nav-elster',
      label: 'ELSTER / UStVA',
      icon: <Zap className="h-4 w-4" />,
      action: () => { navigate('/elster'); setIsOpen(false); },
      keywords: ['elster', 'ustva', 'steuer'],
      group: 'Navigation',
    },
    {
      id: 'nav-settings',
      label: 'Einstellungen',
      icon: <Settings className="h-4 w-4" />,
      action: () => { navigate('/einstellungen'); setIsOpen(false); },
      keywords: ['einstellungen', 'settings', 'datev', 'export'],
      group: 'Navigation',
    },
  ];

  const grouped = actions.reduce((acc, a) => {
    if (!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      {mode === 'search' ? (
        <>
          <CommandInput placeholder="Suchen oder Befehl eingeben..." ref={inputRef} />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            {Object.entries(grouped).map(([group, items], i) => (
              <div key={group}>
                {i > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {items.map((action) => (
                    <CommandItem
                      key={action.id}
                      value={[action.label, ...(action.keywords || [])].join(' ')}
                      onSelect={action.action}
                      className="gap-3 cursor-pointer"
                    >
                      {action.icon}
                      <div className="flex-1">
                        <span className="font-medium">{action.label}</span>
                        {action.description && (
                          <span className="text-xs text-muted-foreground ml-2">{action.description}</span>
                        )}
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">↑↓</kbd> Navigieren</span>
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">↵</kbd> Auswählen</span>
            <span><kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Esc</kbd> Schließen</span>
          </div>
        </>
      ) : (
        <div className="p-4 space-y-3">
          <div className={`flex items-center gap-2 text-sm font-semibold ${mode === 'income' ? 'text-green-500' : 'text-red-500'}`}>
            {mode === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            Schnell-{mode === 'income' ? 'Einnahme' : 'Ausgabe'} erfassen
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
              if (e.key === 'Enter') handleQuickBooking(mode);
              if (e.key === 'Escape') setMode('search');
            }}
          />
          <input
            type="text"
            placeholder="Beschreibung (optional)"
            value={quickDesc}
            onChange={(e) => setQuickDesc(e.target.value)}
            className="w-full px-3 py-2 bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickBooking(mode);
              if (e.key === 'Escape') setMode('search');
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickBooking(mode)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${mode === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              Speichern (Enter)
            </button>
            <button
              onClick={() => setMode('search')}
              className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Zurück (Esc)
            </button>
          </div>
        </div>
      )}
    </CommandDialog>
  );
}
