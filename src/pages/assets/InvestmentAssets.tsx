import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, TrendingUp, TrendingDown, Search, Pencil, Trash2, MoreHorizontal,
  RefreshCw, ArrowUpRight, ArrowDownRight, Loader2, X, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  searchSecurities, getQuote, getHistoricalData,
  formatPrice, type StockQuote, type SearchResult, type HistoricalPoint,
} from '@/services/stockQuotes';

interface Asset {
  id: string;
  name: string;
  type: string;
  description: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  units: number | null;
  serial_number: string | null; // used as ticker symbol
  notes: string | null;
}

const ASSET_CLASSES = [
  { value: 'aktien', label: 'Aktien' },
  { value: 'etf', label: 'ETF / Fonds' },
  { value: 'anleihen', label: 'Anleihen' },
  { value: 'gold', label: 'Gold / Edelmetalle' },
  { value: 'krypto', label: 'Kryptowährungen' },
  { value: 'rohstoffe', label: 'Rohstoffe' },
  { value: 'festgeld', label: 'Festgeld / Tagesgeld' },
  { value: 'sonstige', label: 'Sonstige' },
];

const RANGE_OPTIONS = [
  { value: '1mo', label: '1 Monat' },
  { value: '3mo', label: '3 Monate' },
  { value: '6mo', label: '6 Monate' },
  { value: '1y', label: '1 Jahr' },
  { value: '2y', label: '2 Jahre' },
] as const;

const fmt = (v: number, currency = 'EUR') => formatPrice(v, currency);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`;

export default function InvestmentAssets() {
  const { currentCompany } = useCompany();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  // Security search
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolResults, setSymbolResults] = useState<SearchResult[]>([]);
  const [symbolSearching, setSymbolSearching] = useState(false);

  // Chart state
  const [chartAsset, setChartAsset] = useState<Asset | null>(null);
  const [chartData, setChartData] = useState<HistoricalPoint[]>([]);
  const [chartRange, setChartRange] = useState<'1mo' | '3mo' | '6mo' | '1y' | '2y'>('1y');
  const [chartLoading, setChartLoading] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: '', asset_class: 'aktien', symbol: '',
    quantity: '', purchase_date: '', purchase_price: '', current_value: '', notes: '',
  });

  useEffect(() => { if (currentCompany) fetchAssets(); }, [currentCompany]);

  const fetchAssets = async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data } = await supabase.from('assets').select('*')
      .eq('company_id', currentCompany.id).eq('type', 'asset')
      .order('created_at', { ascending: false });
    if (data) {
      setAssets(data);
      fetchQuotes(data);
    }
    setLoading(false);
  };

  const fetchQuotes = useCallback(async (assetList: Asset[]) => {
    const symbols = assetList.map((a) => a.serial_number).filter(Boolean) as string[];
    if (symbols.length === 0) return;
    setQuotesLoading(true);
    const results = await Promise.all(symbols.map((s) => getQuote(s).then((q) => [s, q] as [string, StockQuote | null])));
    const map: Record<string, StockQuote> = {};
    results.forEach(([s, q]) => { if (q) map[s] = q; });
    setQuotes(map);
    setQuotesLoading(false);
  }, []);

  const handleSymbolSearch = async (q: string) => {
    setSymbolSearch(q);
    if (q.length < 2) { setSymbolResults([]); return; }
    setSymbolSearching(true);
    const results = await searchSecurities(q);
    setSymbolResults(results);
    setSymbolSearching(false);
  };

  const handleSelectSymbol = (result: SearchResult) => {
    setForm((f) => ({ ...f, symbol: result.symbol, name: f.name || result.name }));
    setSymbolSearch(result.name);
    setSymbolResults([]);
  };

  const openDialog = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset);
      setForm({
        name: asset.name, asset_class: asset.description || 'aktien',
        symbol: asset.serial_number || '', quantity: String(asset.units || ''),
        purchase_date: asset.purchase_date || '', purchase_price: String(asset.purchase_price || ''),
        current_value: String(asset.current_value || ''), notes: asset.notes || '',
      });
      setSymbolSearch(asset.serial_number || '');
    } else {
      setEditingAsset(null);
      setForm({ name: '', asset_class: 'aktien', symbol: '', quantity: '', purchase_date: '', purchase_price: '', current_value: '', notes: '' });
      setSymbolSearch('');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany || !form.name.trim()) {
      toast.error('Name ist ein Pflichtfeld');
      return;
    }
    setSaving(true);
    const payload = {
      company_id: currentCompany.id, name: form.name.trim(), type: 'asset',
      description: form.asset_class, serial_number: form.symbol || null,
      units: form.quantity ? parseFloat(form.quantity) : null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      notes: form.notes || null,
    };
    const { error } = editingAsset
      ? await supabase.from('assets').update(payload).eq('id', editingAsset.id)
      : await supabase.from('assets').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingAsset ? 'Position aktualisiert' : 'Position hinzugefügt');
    setDialogOpen(false);
    fetchAssets();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Position gelöscht');
    fetchAssets();
  };

  const openChart = async (asset: Asset) => {
    setChartAsset(asset);
    if (!asset.serial_number) return;
    setChartLoading(true);
    const data = await getHistoricalData(asset.serial_number, chartRange);
    setChartData(data);
    setChartLoading(false);
  };

  const reloadChart = async (range: typeof chartRange) => {
    setChartRange(range);
    if (!chartAsset?.serial_number) return;
    setChartLoading(true);
    const data = await getHistoricalData(chartAsset.serial_number, range);
    setChartData(data);
    setChartLoading(false);
  };

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.serial_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    let totalValue = 0, totalCost = 0;
    assets.forEach((a) => {
      const symbol = a.serial_number;
      const quote = symbol ? quotes[symbol] : null;
      const price = quote ? quote.price : null;
      const qty = a.units || 1;
      const val = price ? price * qty : (a.current_value || a.purchase_price || 0);
      totalValue += val;
      totalCost += (a.purchase_price || 0) * qty;
    });
    const gain = totalValue - totalCost;
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    return { totalValue, totalCost, gain, gainPct };
  }, [assets, quotes]);

  if (!currentCompany) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wertpapiere & Depot</h1>
          <p className="text-sm text-muted-foreground">Aktien, ETFs, Anleihen, Krypto</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchQuotes(assets)} disabled={quotesLoading} title="Kurse aktualisieren">
            <RefreshCw className={`h-4 w-4 ${quotesLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />Position
          </Button>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Depotwert', value: fmt(stats.totalValue), color: 'text-primary' },
          { label: 'Einstandswert', value: fmt(stats.totalCost), color: 'text-muted-foreground' },
          { label: 'Gewinn / Verlust', value: fmt(Math.abs(stats.gain)), color: stats.gain >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'Performance', value: fmtPct(stats.gainPct), color: stats.gainPct >= 0 ? 'text-green-500' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{loading ? '...' : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Position suchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {/* Positions List */}
      {loading ? (
        <div className="p-6 space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <TrendingUp className="h-12 w-12 text-muted-foreground opacity-30" />
            <div className="text-center">
              <p className="font-medium">Kein Depot erfasst</p>
              <p className="text-sm text-muted-foreground mt-1">Fügen Sie Ihre erste Wertpapierposition hinzu.</p>
            </div>
            <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" />Erste Position</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((asset) => {
            const symbol = asset.serial_number;
            const quote = symbol ? quotes[symbol] : null;
            const qty = asset.units || 1;
            const currentPrice = quote?.price ?? (asset.current_value ? asset.current_value / qty : null);
            const currentValue = currentPrice ? currentPrice * qty : (asset.current_value || 0);
            const costBasis = (asset.purchase_price || 0) * qty;
            const gain = currentValue - costBasis;
            const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
            const assetClass = ASSET_CLASSES.find((c) => c.value === asset.description);

            return (
              <Card key={asset.id} className="hover:bg-muted/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${gain >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {gain >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{asset.name}</span>
                        {symbol && <Badge variant="outline" className="text-xs font-mono">{symbol}</Badge>}
                        {assetClass && <Badge variant="secondary" className="text-xs">{assetClass.label}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                        {qty !== 1 && <span>{qty} Stück</span>}
                        {asset.purchase_price && <span>EK: {fmt(asset.purchase_price)}</span>}
                        {quote && <span className="text-xs">Kurs: {fmt(quote.price, quote.currency)}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base">{fmt(currentValue)}</p>
                      {costBasis > 0 && (
                        <p className={`text-xs flex items-center justify-end gap-0.5 ${gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {gain >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {fmtPct(gainPct)}
                        </p>
                      )}
                      {quote && (
                        <p className={`text-xs ${quote.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          Heute: {fmtPct(quote.changePercent)}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {symbol && (
                          <DropdownMenuItem onClick={() => openChart(asset)}>
                            <TrendingUp className="mr-2 h-4 w-4" />Kurschart
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openDialog(asset)}>
                          <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(asset.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* Live-Kurs Details */}
                  {quote && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div><p className="font-medium text-foreground">{fmt(quote.price, quote.currency)}</p><p>Aktuell</p></div>
                      <div><p className="font-medium text-foreground">{fmt(quote.fiftyTwoWeekLow || 0, quote.currency)}</p><p>52W Tief</p></div>
                      <div><p className="font-medium text-foreground">{fmt(quote.fiftyTwoWeekHigh || 0, quote.currency)}</p><p>52W Hoch</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Chart Dialog */}
      <Dialog open={!!chartAsset} onOpenChange={(o) => { if (!o) setChartAsset(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{chartAsset?.name} – Kursverlauf</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 flex-wrap mb-2">
            {RANGE_OPTIONS.map((r) => (
              <Button key={r.value} size="sm" variant={chartRange === r.value ? 'default' : 'outline'}
                onClick={() => reloadChart(r.value)}>{r.label}</Button>
            ))}
          </div>
          {chartLoading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v.toFixed(0)}`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => [v.toFixed(2), 'Kurs']}
                />
                <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2} fill="url(#chartGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              {chartAsset?.serial_number ? 'Keine Kursdaten verfügbar' : 'Kein Ticker-Symbol hinterlegt'}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setSymbolResults([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Position bearbeiten' : 'Neue Position'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Symbol-Suche */}
            <div className="space-y-2">
              <Label>Wertpapier suchen (Name, ISIN, Ticker)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={symbolSearch}
                  onChange={(e) => handleSymbolSearch(e.target.value)}
                  placeholder="z.B. Apple, DE000BAY0017, AAPL"
                  className="pl-10"
                />
                {symbolSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {symbolResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {symbolResults.map((r) => (
                    <button key={r.symbol} onClick={() => handleSelectSymbol(r)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left text-sm border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.exchange} · {r.type}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">{r.symbol}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Bezeichnung *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Apple Inc." />
              </div>
              <div className="space-y-2">
                <Label>Ticker-Symbol</Label>
                <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} placeholder="AAPL" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Anlageklasse</Label>
                <Select value={form.asset_class} onValueChange={(v) => setForm({ ...form, asset_class: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSET_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anzahl / Stück</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Kaufkurs (€)</Label>
                <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Kaufdatum</Label>
                <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Aktueller Kurs (€)</Label>
                <Input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} placeholder="Automatisch via API" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notizen</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Depot, Strategie, etc." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern...' : editingAsset ? 'Aktualisieren' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
