/**
 * ContractExpiryWidget – Ablaufende Verträge für das Dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { FileText, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Contract {
  id: string;
  name: string;
  partner: string;
  end_date: string;
  daysLeft: number;
}

export function ContractExpiryWidget() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContracts = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const today = new Date();
      const in90Days = new Date(today);
      in90Days.setDate(today.getDate() + 90);

      const { data } = await supabase
        .from('contracts')
        .select('id, name, partner, end_date')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active')
        .gte('end_date', today.toISOString().split('T')[0])
        .lte('end_date', in90Days.toISOString().split('T')[0])
        .order('end_date', { ascending: true })
        .limit(5);

      if (data) {
        setContracts(data.map(c => ({
          ...c,
          daysLeft: Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Verträge ablaufend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/vertragsmanagement')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Verträge ablaufend
          {contracts.some(c => c.daysLeft <= 30) && (
            <Badge variant="destructive" className="text-xs ml-auto">{contracts.filter(c => c.daysLeft <= 30).length} dringend</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm">Keine Verträge laufen in 90 Tagen ab</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.partner}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.daysLeft <= 14 ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <Clock className="h-3 w-3 text-orange-400" />}
                  <span className={`text-xs font-bold ${c.daysLeft <= 14 ? 'text-red-600' : c.daysLeft <= 30 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {c.daysLeft}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
