/**
 * ActivityFeedWidget – Live Activity-Feed für das Dashboard
 * Zeigt die letzten Aktionen (Buchungen, Rechnungen, Belege) in Echtzeit
 */
import { useState, useEffect, useCallback } from 'react';
import { Activity, FileText, Receipt, Banknote, User, ArrowRight, RefreshCw } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

interface ActivityItem {
  id: string;
  type: 'transaction' | 'invoice' | 'receipt' | 'contact';
  title: string;
  subtitle: string;
  amount?: number;
  amountType?: 'income' | 'expense';
  date: string;
  url: string;
  badge?: string;
  badgeColor?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  return new Date(dateStr).toLocaleDateString('de-DE');
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  transaction: <Banknote className="h-4 w-4" />,
  invoice: <FileText className="h-4 w-4" />,
  receipt: <Receipt className="h-4 w-4" />,
  contact: <User className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  transaction: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  invoice: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  receipt: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  contact: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
};

export function ActivityFeedWidget() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const [txRes, invRes, receiptRes, contactRes] = await Promise.all([
        supabase.from('transactions').select('id, description, amount, type, date, created_at').eq('company_id', currentCompany.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('invoices').select('id, invoice_number, contact_name, total_amount, status, created_at').eq('company_id', currentCompany.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('receipts').select('id, description, amount, category, created_at').eq('company_id', currentCompany.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('contacts').select('id, name, type, created_at').eq('company_id', currentCompany.id).order('created_at', { ascending: false }).limit(3),
      ]);

      const items: ActivityItem[] = [];

      (txRes.data || []).forEach(t => items.push({
        id: `tx-${t.id}`,
        type: 'transaction',
        title: t.description || 'Buchung',
        subtitle: t.type === 'income' ? 'Einnahme gebucht' : 'Ausgabe gebucht',
        amount: Math.abs(t.amount || 0),
        amountType: t.type as 'income' | 'expense',
        date: t.created_at || t.date,
        url: '/buchungen',
      }));

      (invRes.data || []).forEach(i => items.push({
        id: `inv-${i.id}`,
        type: 'invoice',
        title: `Rechnung ${i.invoice_number}`,
        subtitle: i.contact_name || 'Unbekannt',
        amount: i.total_amount || 0,
        amountType: 'income',
        date: i.created_at,
        url: '/rechnungen',
        badge: i.status,
        badgeColor: i.status === 'paid' ? 'bg-green-100 text-green-700' : i.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
      }));

      (receiptRes.data || []).forEach(r => items.push({
        id: `rec-${r.id}`,
        type: 'receipt',
        title: r.description || 'Beleg',
        subtitle: r.category || 'Sonstiges',
        amount: Math.abs(r.amount || 0),
        amountType: 'expense',
        date: r.created_at,
        url: '/belege',
      }));

      (contactRes.data || []).forEach(c => items.push({
        id: `con-${c.id}`,
        type: 'contact',
        title: c.name || 'Kontakt',
        subtitle: c.type === 'customer' ? 'Neuer Kunde' : 'Neuer Lieferant',
        date: c.created_at,
        url: '/kontakte',
      }));

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items.slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    fetchActivities();
    // Echtzeit-Updates alle 30 Sekunden
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Aktivitäten
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchActivities}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Aktivitäten</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.url)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[item.type]}`}>
                  {TYPE_ICONS[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle} · {timeAgo(item.date)}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {item.amount !== undefined && (
                    <p className={`text-sm font-bold ${item.amountType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.amountType === 'income' ? '+' : '-'}{fmt(item.amount)}
                    </p>
                  )}
                  {item.badge && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>{item.badge}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
