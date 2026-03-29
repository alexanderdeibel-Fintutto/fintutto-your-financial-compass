 import { useState, useEffect } from 'react';
 import {
   BarChart3, TrendingUp, PieChart, Building2, FileText, FileSpreadsheet,
   Download, Printer, ArrowUp, ArrowDown, LineChart, Wallet, Search
 } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
 import {
   exportBWApdf, exportGuVpdf, exportJournalPdf, exportSuSaPdf, exportUStVApdf
 } from '@/lib/reportPdf';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ComparisonChart,
  ProfitTrendChart,
  CashFlowForecastChart,
  ExpenseBreakdownChart,
} from '@/components/reports/AdvancedReportCharts';

type ReportType = 'bwa' | 'guv' | 'bilanz' | 'ustva' | 'journal' | 'susa';
type ViewMode = 'standard' | 'charts' | 'forecast' | 'jahresvergleich';

interface ReportOption {
  id: ReportType;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface ReportData {
  income: number;
  expenses: number;
  profit: number;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  prevMonthIncome: number;
  prevMonthExpenses: number;
  prevMonthProfit: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string;
  category: string | null;
  contact_id: string | null;
}

const reportOptions: ReportOption[] = [
  { id: 'bwa', label: 'BWA', icon: BarChart3, color: 'text-blue-500', bgColor: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30' },
  { id: 'guv', label: 'GuV', icon: TrendingUp, color: 'text-green-500', bgColor: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30' },
  { id: 'bilanz', label: 'Bilanz', icon: PieChart, color: 'text-purple-500', bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30' },
  { id: 'ustva', label: 'UStVA', icon: Building2, color: 'text-orange-500', bgColor: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30' },
  { id: 'journal', label: 'Journal', icon: FileText, color: 'text-gray-400', bgColor: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/30' },
  { id: 'susa', label: 'Summen & Salden', icon: FileSpreadsheet, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30' },
];

const periods = [
  { value: 'current-month', label: 'Aktueller Monat' },
  { value: 'prev-month', label: 'Vormonat' },
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
  { value: 'q4', label: 'Q4' },
  { value: 'year', label: 'Ganzes Jahr' },
];

export default function Reports() {
  const { currentCompany } = useCompany();
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [selectedReport, setSelectedReport] = useState<ReportType>('bwa');
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reportData, setReportData] = useState<ReportData>({
    income: 0,
    expenses: 0,
    profit: 0,
    expensesByCategory: {},
    incomeByCategory: {},
    prevMonthIncome: 0,
    prevMonthExpenses: 0,
    prevMonthProfit: 0,
  });

  useEffect(() => {
    if (currentCompany) {
      fetchReportData();
    }
  }, [currentCompany, selectedPeriod]);

  const getDateRange = (period: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'prev-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'q1':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 2, 31);
        break;
      case 'q2':
        startDate = new Date(now.getFullYear(), 3, 1);
        endDate = new Date(now.getFullYear(), 5, 30);
        break;
      case 'q3':
        startDate = new Date(now.getFullYear(), 6, 1);
        endDate = new Date(now.getFullYear(), 8, 30);
        break;
      case 'q4':
        startDate = new Date(now.getFullYear(), 9, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  };

  const fetchReportData = async () => {
    if (!currentCompany) return;

    setLoading(true);
    
    const { startDate, endDate } = getDateRange(selectedPeriod);
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    const prevMonthStart = new Date(startDate);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(startDate);
    prevMonthEnd.setDate(0);

    const { data: prevTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .gte('date', prevMonthStart.toISOString().split('T')[0])
      .lte('date', prevMonthEnd.toISOString().split('T')[0]);

      const income = transactions?.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const expenses = transactions?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const prevMonthIncome = prevTransactions?.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const prevMonthExpenses = prevTransactions?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const expensesByCategory = transactions?.filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const category = t.category || 'Sonstiges';
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>) || {};
    const incomeByCategory = transactions?.filter(t => t.type === 'income')
      .reduce((acc, t) => {
        const category = t.category || 'Umsatzerlöse';
        acc[category] = (acc[category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>) || {};
    // Store raw transactions for Journal/SuSa
    setTransactions((transactions || []).map(t => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category,
      contact_id: t.contact_id,
    })));
    setReportData({
      income,
      expenses,
      profit: income - expenses,
      expensesByCategory,
      incomeByCategory,
      prevMonthIncome,
      prevMonthExpenses,
      prevMonthProfit: prevMonthIncome - prevMonthExpenses,
    });
    
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    if (!isFinite(value)) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const handlePrint = () => {
    window.print();
  };

  const getPeriodLabel = () => {
    return periods.find(p => p.value === selectedPeriod)?.label || selectedPeriod;
  };

  const handleExport = () => {
    const pdfOpts = {
      companyName: currentCompany?.name || 'Unbekannte Firma',
      period: getPeriodLabel(),
      reportType: selectedReport,
    };
    switch (selectedReport) {
      case 'bwa':
        exportBWApdf(reportData, pdfOpts);
        break;
      case 'guv':
        exportGuVpdf(reportData, pdfOpts);
        break;
      case 'journal':
        exportJournalPdf(transactions, pdfOpts);
        break;
      case 'susa':
        exportSuSaPdf(reportData, transactions, pdfOpts);
        break;
      case 'ustva':
        exportUStVApdf(reportData, pdfOpts);
        break;
      default: {
        // CSV-Fallback für Bilanz
        const rows = [
          ['Position', 'Aktuell', 'Vormonat'],
          ['Umsatzerlöse', reportData.income, reportData.prevMonthIncome],
          ...Object.entries(reportData.expensesByCategory).map(([cat, val]) => [cat, val, '']),
          ['Betriebsergebnis', reportData.profit, reportData.prevMonthProfit],
        ];
        const csv = rows.map(row => row.join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedReport}-${selectedPeriod}.csv`;
        link.click();
      }
    }
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Berichte</h1>
          <p className="text-muted-foreground">Auswertungen und Analysen Ihrer Buchhaltung</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            PDF Export
          </Button>

          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Drucken
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsList className="glass">
          <TabsTrigger value="standard" className="gap-2">
            <FileText className="h-4 w-4" />
            Standardberichte
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-2">
            <LineChart className="h-4 w-4" />
            Grafiken & Vergleiche
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <Wallet className="h-4 w-4" />
            Cashflow-Prognose
          </TabsTrigger>
          <TabsTrigger value="jahresvergleich" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Jahresvergleich
          </TabsTrigger>
        </TabsList>

        {/* Standard Reports Tab */}
        <TabsContent value="standard" className="space-y-6 mt-6">
          {/* Report Type Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {reportOptions.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                    isSelected
                      ? `${report.bgColor} border-2`
                      : "glass hover:bg-secondary/50 border-border/50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", report.color)} />
                  <span className={cn("text-sm font-medium", isSelected && report.color)}>
                    {report.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Report Content */}
          {loading ? (
            <div className="glass rounded-xl p-12 text-center text-muted-foreground">
              <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse"/>)}</div>
            </div>
          ) : (
            <>
              {selectedReport === 'bwa' && (
                <BWAReport data={reportData} formatCurrency={formatCurrency} formatPercent={formatPercent} calculateChange={calculateChange} />
              )}
              {selectedReport === 'guv' && (
                <GuVReport data={reportData} formatCurrency={formatCurrency} />
              )}
              {selectedReport === 'bilanz' && (
                <BilanzReport data={reportData} formatCurrency={formatCurrency} />
              )}
              {selectedReport === 'ustva' && (
                <UStVAReport data={reportData} formatCurrency={formatCurrency} />
              )}
              {selectedReport === 'journal' && (
                <JournalReport transactions={transactions} formatCurrency={formatCurrency} />
              )}
              {selectedReport === 'susa' && (
                <SuSaReport data={reportData} transactions={transactions} formatCurrency={formatCurrency} />
              )}
            </>
          )}
        </TabsContent>

        {/* Charts & Comparison Tab */}
        <TabsContent value="charts" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonChart />
            <ProfitTrendChart />
          </div>
          <ExpenseBreakdownChart />
        </TabsContent>

        {/* Cashflow Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6 mt-6">
          <CashFlowForecastChart />
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonChart />
            <ExpenseBreakdownChart />
          </div>
        </TabsContent>

        {/* Jahresvergleich Tab */}
        <TabsContent value="jahresvergleich" className="space-y-6 mt-6">
          <JahresvergleichReport data={reportData} formatCurrency={formatCurrency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// BWA Report Component
function BWAReport({ 
  data, 
  formatCurrency, 
  formatPercent, 
  calculateChange 
}: { 
  data: ReportData; 
  formatCurrency: (n: number) => string;
  formatPercent: (n: number) => string;
  calculateChange: (c: number, p: number) => number;
}) {
  const profitChange = calculateChange(data.profit, data.prevMonthProfit);
  
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Gesamterlöse</p>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(data.income)}</p>
          <div className="flex items-center gap-1 mt-1 text-sm">
            {data.income >= data.prevMonthIncome ? (
              <ArrowUp className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            <span className={data.income >= data.prevMonthIncome ? 'text-green-500' : 'text-red-500'}>
              {formatPercent(calculateChange(data.income, data.prevMonthIncome))}
            </span>
          </div>
        </div>
        
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Gesamtaufwand</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(data.expenses)}</p>
          <div className="flex items-center gap-1 mt-1 text-sm">
            {data.expenses <= data.prevMonthExpenses ? (
              <ArrowDown className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowUp className="h-3 w-3 text-red-500" />
            )}
            <span className={data.expenses <= data.prevMonthExpenses ? 'text-green-500' : 'text-red-500'}>
              {formatPercent(calculateChange(data.expenses, data.prevMonthExpenses))}
            </span>
          </div>
        </div>
        
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">Betriebsergebnis</p>
          <p className={cn("text-2xl font-bold", data.profit >= 0 ? 'text-green-500' : 'text-red-500')}>
            {formatCurrency(data.profit)}
          </p>
        </div>
        
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">vs. Vormonat</p>
          <div className="flex items-center gap-2">
            {profitChange >= 0 ? (
              <ArrowUp className="h-6 w-6 text-green-500" />
            ) : (
              <ArrowDown className="h-6 w-6 text-red-500" />
            )}
            <p className={cn("text-2xl font-bold", profitChange >= 0 ? 'text-green-500' : 'text-red-500')}>
              {formatPercent(profitChange)}
            </p>
          </div>
        </div>
      </div>

      {/* BWA Table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-[40%]">Position</TableHead>
              <TableHead className="text-right">Aktuell</TableHead>
              <TableHead className="text-right">Vormonat</TableHead>
              <TableHead className="text-right">Plan</TableHead>
              <TableHead className="text-right">Abweichung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Betriebserlöse Section */}
            <TableRow className="bg-green-500/10 border-green-500/30">
              <TableCell colSpan={5} className="font-bold text-green-500">
                Betriebserlöse
              </TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell className="pl-6">Umsatzerlöse</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(data.income)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(data.prevMonthIncome)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
              <TableCell className={cn("text-right", calculateChange(data.income, data.prevMonthIncome) >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatPercent(calculateChange(data.income, data.prevMonthIncome))}
              </TableCell>
            </TableRow>
            <TableRow className="border-border/30 bg-secondary/30">
              <TableCell className="font-semibold">Summe Erlöse</TableCell>
              <TableCell className="text-right font-bold text-green-500">{formatCurrency(data.income)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(data.prevMonthIncome)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className={cn("text-right font-medium", calculateChange(data.income, data.prevMonthIncome) >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatPercent(calculateChange(data.income, data.prevMonthIncome))}
              </TableCell>
            </TableRow>

            {/* Betriebsaufwand Section */}
            <TableRow className="bg-red-500/10 border-red-500/30">
              <TableCell colSpan={5} className="font-bold text-red-500">
                Betriebsaufwand
              </TableCell>
            </TableRow>
            {['Materialaufwand', 'Personalaufwand', 'Miete', 'Versicherungen', 'Telefon/Internet', 'Bürobedarf', 'Beratungskosten', 'IT-Kosten', 'Sonstiges'].map((category) => (
              <TableRow key={category} className="border-border/30">
                <TableCell className="pl-6">{category}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(data.expensesByCategory[category] || 0)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-border/30 bg-secondary/30">
              <TableCell className="font-semibold">Summe Aufwand</TableCell>
              <TableCell className="text-right font-bold text-red-500">{formatCurrency(data.expenses)}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(data.prevMonthExpenses)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className={cn("text-right font-medium", calculateChange(data.expenses, data.prevMonthExpenses) <= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatPercent(calculateChange(data.expenses, data.prevMonthExpenses))}
              </TableCell>
            </TableRow>

            {/* Betriebsergebnis */}
            <TableRow className={cn("border-t-2", data.profit >= 0 ? 'bg-green-500/5 border-green-500/50' : 'bg-red-500/5 border-red-500/50')}>
              <TableCell className="font-bold text-lg">Betriebsergebnis</TableCell>
              <TableCell className={cn("text-right font-bold text-lg", data.profit >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatCurrency(data.profit)}
              </TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(data.prevMonthProfit)}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className={cn("text-right font-bold", calculateChange(data.profit, data.prevMonthProfit) >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatPercent(calculateChange(data.profit, data.prevMonthProfit))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// GuV Report Component
function GuVReport({ 
  data, 
  formatCurrency 
}: { 
  data: ReportData; 
  formatCurrency: (n: number) => string;
}) {
  const materialCosts = data.expensesByCategory['Materialaufwand'] || 0;
  const rohertrag = data.income - materialCosts;
  const personalCosts = data.expensesByCategory['Personalaufwand'] || 0;
  const otherExpenses = data.expenses - materialCosts - personalCosts;
  const betriebsergebnis = rohertrag - personalCosts - otherExpenses;
  const finanzergebnis = 0;
  const steuern = betriebsergebnis > 0 ? betriebsergebnis * 0.15 : 0;
  const jahresueberschuss = betriebsergebnis + finanzergebnis - steuern;

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-secondary/30">
          <h2 className="text-lg font-bold">Gewinn- und Verlustrechnung</h2>
          <p className="text-sm text-muted-foreground">nach § 275 HGB (Gesamtkostenverfahren)</p>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-[60%]">Position</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead className="text-right">Vorjahr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-border/30">
              <TableCell>1. Umsatzerlöse</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(data.income)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(data.prevMonthIncome)}</TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell>2. Materialaufwand</TableCell>
              <TableCell className="text-right font-medium text-red-500">-{formatCurrency(materialCosts)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30 bg-secondary/30">
              <TableCell className="font-semibold">= Rohertrag</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(rohertrag)}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell>3. Personalaufwand</TableCell>
              <TableCell className="text-right font-medium text-red-500">-{formatCurrency(personalCosts)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell>4. Sonstige betriebliche Aufwendungen</TableCell>
              <TableCell className="text-right font-medium text-red-500">-{formatCurrency(otherExpenses)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30 bg-secondary/30">
              <TableCell className="font-semibold">= Betriebsergebnis (EBIT)</TableCell>
              <TableCell className={cn("text-right font-bold", betriebsergebnis >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatCurrency(betriebsergebnis)}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell>5. Finanzergebnis</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(finanzergebnis)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>
            <TableRow className="border-border/30">
              <TableCell>6. Steuern vom Einkommen</TableCell>
              <TableCell className="text-right font-medium text-red-500">-{formatCurrency(steuern)}</TableCell>
              <TableCell className="text-right text-muted-foreground">-</TableCell>
            </TableRow>
            <TableRow className={cn("border-t-2", jahresueberschuss >= 0 ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50')}>
              <TableCell className="font-bold text-lg">= Jahresüberschuss/-fehlbetrag</TableCell>
              <TableCell className={cn("text-right font-bold text-lg", jahresueberschuss >= 0 ? 'text-green-500' : 'text-red-500')}>
                {formatCurrency(jahresueberschuss)}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Bilanz Report Component
function BilanzReport({ 
  data, 
  formatCurrency 
}: { 
  data: ReportData; 
  formatCurrency: (n: number) => string;
}) {
  const aktiva = {
    anlagevermoegen: 50000,
    umlaufvermoegen: data.income - data.expenses + 10000,
  };
  const passiva = {
    eigenkapital: 25000 + (data.profit > 0 ? data.profit : 0),
    verbindlichkeiten: aktiva.anlagevermoegen + aktiva.umlaufvermoegen - 25000 - (data.profit > 0 ? data.profit : 0),
  };
  
  const bilanzsumme = aktiva.anlagevermoegen + aktiva.umlaufvermoegen;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Aktiva */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-blue-500/10">
            <h2 className="text-lg font-bold text-blue-500">Aktiva</h2>
          </div>
          <Table>
            <TableBody>
              <TableRow className="bg-secondary/30 border-border/30">
                <TableCell className="font-semibold">A. Anlagevermögen</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(aktiva.anlagevermoegen)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">I. Sachanlagen</TableCell>
                <TableCell className="text-right">{formatCurrency(aktiva.anlagevermoegen * 0.8)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">II. Finanzanlagen</TableCell>
                <TableCell className="text-right">{formatCurrency(aktiva.anlagevermoegen * 0.2)}</TableCell>
              </TableRow>
              <TableRow className="bg-secondary/30 border-border/30">
                <TableCell className="font-semibold">B. Umlaufvermögen</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(aktiva.umlaufvermoegen)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">I. Forderungen</TableCell>
                <TableCell className="text-right">{formatCurrency(aktiva.umlaufvermoegen * 0.4)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">II. Kassenbestand, Bankguthaben</TableCell>
                <TableCell className="text-right">{formatCurrency(aktiva.umlaufvermoegen * 0.6)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-primary/50 bg-primary/5">
                <TableCell className="font-bold">Bilanzsumme</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(bilanzsumme)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Passiva */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-purple-500/10">
            <h2 className="text-lg font-bold text-purple-500">Passiva</h2>
          </div>
          <Table>
            <TableBody>
              <TableRow className="bg-secondary/30 border-border/30">
                <TableCell className="font-semibold">A. Eigenkapital</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(passiva.eigenkapital)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">I. Gezeichnetes Kapital</TableCell>
                <TableCell className="text-right">{formatCurrency(25000)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">II. Jahresüberschuss</TableCell>
                <TableCell className={cn("text-right", data.profit >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {formatCurrency(data.profit > 0 ? data.profit : 0)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-secondary/30 border-border/30">
                <TableCell className="font-semibold">B. Verbindlichkeiten</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(passiva.verbindlichkeiten)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">I. Verbindlichkeiten ggü. Kreditinstituten</TableCell>
                <TableCell className="text-right">{formatCurrency(passiva.verbindlichkeiten * 0.7)}</TableCell>
              </TableRow>
              <TableRow className="border-border/30">
                <TableCell className="pl-6">II. Sonstige Verbindlichkeiten</TableCell>
                <TableCell className="text-right">{formatCurrency(passiva.verbindlichkeiten * 0.3)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-primary/50 bg-primary/5">
                <TableCell className="font-bold">Bilanzsumme</TableCell>
                <TableCell className="text-right font-bold text-primary">{formatCurrency(bilanzsumme)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UStVA Report Component
// ─────────────────────────────────────────────────────────────────────────────
function UStVAReport({
  data,
  formatCurrency,
}: {
  data: ReportData;
  formatCurrency: (n: number) => string;
}) {
  // Netto-Umsätze (Brutto / 1.19)
  const netto19 = data.income / 1.19;
  const ust19 = netto19 * 0.19;
  // Vorsteuer aus Ausgaben
  const vorsteuer = (data.expenses / 1.19) * 0.19;
  // Vorauszahlung
  const vorauszahlung = ust19 - vorsteuer;

  const rows: { label: string; kz: string; value: number; highlight?: boolean }[] = [
    { label: 'Steuerpflichtige Umsätze 19 %', kz: '81', value: netto19 },
    { label: 'Steuerpflichtige Umsätze 7 %', kz: '86', value: 0 },
    { label: 'Steuer auf KZ 81 (19 %)', kz: '83', value: ust19 },
    { label: 'Steuer auf KZ 86 (7 %)', kz: '93', value: 0 },
    { label: 'Abziehbare Vorsteuerbeträge', kz: '66', value: vorsteuer },
    { label: 'Verbleibende USt-Vorauszahlung', kz: '69', value: vorauszahlung, highlight: true },
  ];

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-orange-500/10">
          <h2 className="text-lg font-bold text-orange-500">Umsatzsteuer-Voranmeldung (UStVA)</h2>
          <p className="text-sm text-muted-foreground">Automatisch berechnet aus Transaktionen</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Bezeichnung</TableHead>
              <TableHead className="text-center w-20">KZ</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.kz}
                className={cn(
                  'border-border/30',
                  row.highlight && (vorauszahlung >= 0 ? 'bg-red-500/10 border-t-2 border-red-500/40' : 'bg-green-500/10 border-t-2 border-green-500/40')
                )}
              >
                <TableCell className={row.highlight ? 'font-bold' : ''}>{row.label}</TableCell>
                <TableCell className="text-center font-mono text-muted-foreground">{row.kz}</TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium',
                    row.highlight && (vorauszahlung >= 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold')
                  )}
                >
                  {formatCurrency(row.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Hinweis</p>
        <p>
          Diese Berechnung basiert auf Ihren erfassten Transaktionen und geht von einem einheitlichen
          MwSt-Satz von 19 % aus. Für eine rechtssichere UStVA nutzen Sie bitte die{' '}
          <a href="/elster" className="text-primary underline">ELSTER-Seite</a>.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal Report Component
// ─────────────────────────────────────────────────────────────────────────────
function JournalReport({
  transactions,
  formatCurrency,
}: {
  transactions: Transaction[];
  formatCurrency: (n: number) => string;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const filtered = sorted.filter((t) => {
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesSearch =
      !search ||
      (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const runningBalance = filtered.reduce<{ t: Transaction; balance: number }[]>((acc, t) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    const delta = t.type === 'income' ? t.amount : -t.amount;
    acc.push({ t, balance: prev + delta });
    return acc;
  }, []);

  if (transactions.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Keine Buchungen im gewählten Zeitraum</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buchung suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                typeFilter === f
                  ? f === 'income'
                    ? 'bg-green-500/20 border-green-500/50 text-green-500'
                    : f === 'expense'
                    ? 'bg-red-500/20 border-red-500/50 text-red-500'
                    : 'bg-primary/20 border-primary/50 text-primary'
                  : 'glass border-border/50 text-muted-foreground hover:bg-secondary/50'
              )}
            >
              {f === 'all' ? 'Alle' : f === 'income' ? 'Einnahmen' : 'Ausgaben'}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="self-center">
          {filtered.length} Buchungen
        </Badge>
      </div>

      {/* Journal Table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-28">Datum</TableHead>
              <TableHead>Buchungstext</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Soll</TableHead>
              <TableHead className="text-right">Haben</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runningBalance.map(({ t, balance }) => (
              <TableRow key={t.id} className="border-border/30 hover:bg-secondary/30">
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {new Date(t.date).toLocaleDateString('de-DE')}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {t.description || '—'}
                </TableCell>
                <TableCell>
                  {t.category ? (
                    <Badge variant="outline" className="text-xs">
                      {t.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {t.type === 'expense' ? (
                    <span className="text-red-500">{formatCurrency(t.amount)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {t.type === 'income' ? (
                    <span className="text-green-500">{formatCurrency(t.amount)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono font-medium',
                    balance >= 0 ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {formatCurrency(balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summen & Salden Report Component
// ─────────────────────────────────────────────────────────────────────────────
function SuSaReport({
  data,
  transactions,
  formatCurrency,
}: {
  data: ReportData;
  transactions: Transaction[];
  formatCurrency: (n: number) => string;
}) {
  // SKR03-Konten-Mapping
  const SKR03_KONTEN: Record<string, { konto: string; bezeichnung: string; klasse: string }> = {
    'Umsatzerlöse': { konto: '8400', bezeichnung: 'Erlöse 19 % USt', klasse: 'Klasse 8' },
    'Sonstige Einnahmen': { konto: '8910', bezeichnung: 'Sonstige betriebliche Erträge', klasse: 'Klasse 8' },
    'Miete': { konto: '4210', bezeichnung: 'Miete', klasse: 'Klasse 4' },
    'Personalaufwand': { konto: '4100', bezeichnung: 'Löhne und Gehälter', klasse: 'Klasse 4' },
    'Materialaufwand': { konto: '3200', bezeichnung: 'Wareneinkauf', klasse: 'Klasse 3' },
    'Bürobedarf': { konto: '4930', bezeichnung: 'Bürobedarf', klasse: 'Klasse 4' },
    'IT-Kosten': { konto: '4970', bezeichnung: 'EDV-Kosten', klasse: 'Klasse 4' },
    'Telefon/Internet': { konto: '4920', bezeichnung: 'Telefon', klasse: 'Klasse 4' },
    'Versicherungen': { konto: '4360', bezeichnung: 'Versicherungen', klasse: 'Klasse 4' },
    'Beratungskosten': { konto: '4980', bezeichnung: 'Beratungskosten', klasse: 'Klasse 4' },
    'Fahrtkosten': { konto: '4670', bezeichnung: 'Reisekosten', klasse: 'Klasse 4' },
    'Sonstiges': { konto: '4990', bezeichnung: 'Sonstige Aufwendungen', klasse: 'Klasse 4' },
  };

  // Alle Kategorien aus Transaktionen sammeln
  const allCategories = new Set<string>();
  transactions.forEach((t) => allCategories.add(t.category || (t.type === 'income' ? 'Umsatzerlöse' : 'Sonstiges')));

  // Summen pro Kategorie berechnen
  const rows = Array.from(allCategories).map((cat) => {
    const catTransactions = transactions.filter(
      (t) => (t.category || (t.type === 'income' ? 'Umsatzerlöse' : 'Sonstiges')) === cat
    );
    const soll = catTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const haben = catTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const saldo = haben - soll;
    const kontoInfo = SKR03_KONTEN[cat] || { konto: '9999', bezeichnung: cat, klasse: 'Sonstige' };
    return { cat, kontoInfo, soll, haben, saldo, count: catTransactions.length };
  }).sort((a, b) => a.kontoInfo.konto.localeCompare(b.kontoInfo.konto));

  const totalSoll = rows.reduce((s, r) => s + r.soll, 0);
  const totalHaben = rows.reduce((s, r) => s + r.haben, 0);
  const totalSaldo = totalHaben - totalSoll;

  if (transactions.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Keine Buchungen im gewählten Zeitraum</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Summe Soll (Aufwand)</p>
          <p className="text-xl font-bold text-red-500">{formatCurrency(totalSoll)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Summe Haben (Ertrag)</p>
          <p className="text-xl font-bold text-green-500">{formatCurrency(totalHaben)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className={cn('text-xl font-bold', totalSaldo >= 0 ? 'text-green-500' : 'text-red-500')}>
            {formatCurrency(totalSaldo)}
          </p>
        </div>
      </div>

      {/* SuSa Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-cyan-500/10">
          <h2 className="text-lg font-bold text-cyan-500">Summen- und Saldenliste (SKR03)</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="w-20">Konto</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead className="text-center w-20">Buchungen</TableHead>
              <TableHead className="text-right">Soll</TableHead>
              <TableHead className="text-right">Haben</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cat} className="border-border/30 hover:bg-secondary/30">
                <TableCell className="font-mono text-sm">{row.kontoInfo.konto}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{row.kontoInfo.bezeichnung}</p>
                    <p className="text-xs text-muted-foreground">{row.kontoInfo.klasse}</p>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{row.count}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.soll > 0 ? (
                    <span className="text-red-500">{formatCurrency(row.soll)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {row.haben > 0 ? (
                    <span className="text-green-500">{formatCurrency(row.haben)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono font-medium text-sm',
                    row.saldo >= 0 ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {formatCurrency(Math.abs(row.saldo))}
                  <span className="text-xs ml-1">{row.saldo >= 0 ? 'H' : 'S'}</span>
                </TableCell>
              </TableRow>
            ))}
            {/* Totals */}
            <TableRow className="border-t-2 border-primary/50 bg-primary/5">
              <TableCell colSpan={3} className="font-bold">Summe</TableCell>
              <TableCell className="text-right font-bold text-red-500 font-mono">
                {formatCurrency(totalSoll)}
              </TableCell>
              <TableCell className="text-right font-bold text-green-500 font-mono">
                {formatCurrency(totalHaben)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-bold font-mono',
                  totalSaldo >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {formatCurrency(Math.abs(totalSaldo))}
                <span className="text-xs ml-1">{totalSaldo >= 0 ? 'H' : 'S'}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Jahresvergleich Report ───────────────────────────────────────────────────
function JahresvergleichReport({ data, formatCurrency }: { data: ReportData; formatCurrency: (n: number) => string }) {
  const currentYear = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  // Build monthly breakdown from data
  const monthlyData = months.map((month, i) => {
    const einnahmen = data.monthlyRevenue?.[i] ?? 0;
    const ausgaben = data.monthlyExpenses?.[i] ?? 0;
    const ergebnis = einnahmen - ausgaben;
    return { month, einnahmen, ausgaben, ergebnis };
  });

  const totalEinnahmen = monthlyData.reduce((s, m) => s + m.einnahmen, 0);
  const totalAusgaben = monthlyData.reduce((s, m) => s + m.ausgaben, 0);
  const totalErgebnis = totalEinnahmen - totalAusgaben;
  const bestMonth = [...monthlyData].sort((a, b) => b.ergebnis - a.ergebnis)[0];
  const worstMonth = [...monthlyData].sort((a, b) => a.ergebnis - b.ergebnis)[0];

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gesamteinnahmen', value: totalEinnahmen, color: 'text-green-500' },
          { label: 'Gesamtausgaben', value: totalAusgaben, color: 'text-red-500' },
          { label: 'Jahresergebnis', value: totalErgebnis, color: totalErgebnis >= 0 ? 'text-green-500' : 'text-red-500' },
          { label: 'Ø Monatsergebnis', value: totalErgebnis / 12, color: totalErgebnis >= 0 ? 'text-green-500' : 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Best / Worst Month */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 border border-green-500/20">
          <p className="text-xs text-muted-foreground mb-1">Bester Monat</p>
          <p className="text-lg font-bold text-green-500">{bestMonth.month}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(bestMonth.ergebnis)}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-red-500/20">
          <p className="text-xs text-muted-foreground mb-1">Schwächster Monat</p>
          <p className="text-lg font-bold text-red-500">{worstMonth.month}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(worstMonth.ergebnis)}</p>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold">Monatliche Übersicht {currentYear}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="text-left p-3 font-medium">Monat</th>
                <th className="text-right p-3 font-medium text-green-500">Einnahmen</th>
                <th className="text-right p-3 font-medium text-red-500">Ausgaben</th>
                <th className="text-right p-3 font-medium">Ergebnis</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Marge</th>
                <th className="p-3 font-medium">Verlauf</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(({ month, einnahmen, ausgaben, ergebnis }) => {
                const marge = einnahmen > 0 ? (ergebnis / einnahmen) * 100 : 0;
                const barWidth = Math.min(100, Math.abs(ergebnis) / Math.max(1, Math.max(...monthlyData.map(m => Math.abs(m.ergebnis)))) * 100);
                return (
                  <tr key={month} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-medium">{month}</td>
                    <td className="p-3 text-right font-mono text-green-500">{formatCurrency(einnahmen)}</td>
                    <td className="p-3 text-right font-mono text-red-500">{formatCurrency(ausgaben)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${ergebnis >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(ergebnis)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{marge.toFixed(1)}%</td>
                    <td className="p-3">
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ergebnis >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/50 bg-primary/5 font-bold">
                <td className="p-3">Gesamt</td>
                <td className="p-3 text-right font-mono text-green-500">{formatCurrency(totalEinnahmen)}</td>
                <td className="p-3 text-right font-mono text-red-500">{formatCurrency(totalAusgaben)}</td>
                <td className={`p-3 text-right font-mono ${totalErgebnis >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(totalErgebnis)}
                </td>
                <td className="p-3 text-right text-muted-foreground">
                  {totalEinnahmen > 0 ? ((totalErgebnis / totalEinnahmen) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="p-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Steuerzusammenfassung */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span className="text-primary">§</span> Steuerliche Zusammenfassung {currentYear}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Umsatz brutto (19% MwSt)', value: data.totalRevenue * 1.19, hint: 'inkl. MwSt' },
            { label: 'Umsatz netto', value: data.totalRevenue, hint: 'Bemessungsgrundlage' },
            { label: 'Umsatzsteuer (KZ 81)', value: data.totalRevenue * 0.19, hint: 'abzuführen' },
            { label: 'Vorsteuer (KZ 66)', value: data.totalExpenses * 0.19, hint: 'abzugsfähig' },
            { label: 'Zahllast (KZ 69)', value: Math.max(0, data.totalRevenue * 0.19 - data.totalExpenses * 0.19), hint: 'an Finanzamt' },
            { label: 'Gewinn vor Steuer', value: totalErgebnis, hint: 'EStG / KStG' },
          ].map(({ label, value, hint }) => (
            <div key={label} className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base font-bold font-mono mt-1">{formatCurrency(value)}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
