/**
 * OpenItemsWidget – Offene Posten Zusammenfassung für Dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { FileText, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const fmt = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export function OpenItemsWidget() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState({ forderungen: 0, verbindlichkeiten: 0, ueberfaellig: 0, anzahl: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, due_date, status')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue', 'partial', 'dunning']);

      if (invoices) {
        const forderungen = invoices.reduce((s, i) => s + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);
        const ueberfaellig = invoices.filter(i => i.due_date && i.due_date < today).reduce((s, i) => s + ((i.total_amount || 0) - (i.paid_amount || 0)), 0);
        setData({ forderungen, verbindlichkeiten: 0, ueberfaellig, anzahl: invoices.length });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card className="col-span-full lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/offene-posten')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Offene Posten
          {data.ueberfaellig > 0 && (
            <Badge variant="destructive" className="text-xs ml-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />Überfällig
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Offene Forderungen</span>
              </div>
              <span className="text-sm font-bold text-green-600">{fmt(data.forderungen)}</span>
            </div>
            {data.ueberfaellig > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Davon überfällig</span>
                </div>
                <span className="text-sm font-bold text-red-600">{fmt(data.ueberfaellig)}</span>
              </div>
            )}
            <div className="pt-1 border-t">
              <p className="text-xs text-muted-foreground text-center">{data.anzahl} offene Rechnungen → Details anzeigen</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
