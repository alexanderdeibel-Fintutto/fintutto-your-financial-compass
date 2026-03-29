/**
 * InventoryAlertWidget – Mindestbestand-Warnungen für das Dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock: number;
  unit: string;
  shortage: number;
}

export function InventoryAlertWidget() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventory')
        .select('id, name, current_stock, min_stock, unit')
        .eq('company_id', currentCompany.id)
        .not('min_stock', 'is', null)
        .order('name', { ascending: true })
        .limit(100);

      if (data) {
        const alerts = data
          .filter(i => (i.current_stock || 0) <= (i.min_stock || 0))
          .map(i => ({
            ...i,
            current_stock: i.current_stock || 0,
            min_stock: i.min_stock || 0,
            unit: i.unit || 'Stk',
            shortage: (i.min_stock || 0) - (i.current_stock || 0),
          }))
          .sort((a, b) => b.shortage - a.shortage)
          .slice(0, 5);
        setItems(alerts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Lagerbestand-Warnungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/inventar')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Lagerbestand-Warnungen
          {items.length > 0 && (
            <Badge variant="destructive" className="text-xs ml-auto">{items.length} unter Minimum</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm">Alle Bestände über Minimum</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Bestand: {item.current_stock} / Min: {item.min_stock} {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.current_stock === 0 ? (
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-orange-500" />
                  )}
                  <span className={`text-xs font-bold ${item.current_stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {item.current_stock === 0 ? 'Leer' : `-${item.shortage}`}
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
