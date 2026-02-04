import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Building2 } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  bankBalance: number;
  income: number;
  expenses: number;
  profit: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category?: string;
}

export default function Dashboard() {
  const { currentCompany, companies, refetchCompanies } = useCompany();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    bankBalance: 0,
    income: 0,
    expenses: 0,
    profit: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      fetchDashboardData();
    }
  }, [currentCompany]);

  const fetchDashboardData = async () => {
    if (!currentCompany) return;

    // Fetch bank balances
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('balance')
      .eq('company_id', currentCompany.id);

    const bankBalance = bankAccounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

    // Fetch transactions for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .order('date', { ascending: false });

    const income = monthTransactions
      ?.filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const expenses = monthTransactions
      ?.filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    setStats({
      bankBalance,
      income,
      expenses,
      profit: income - expenses,
    });

    // Fetch recent transactions
    const { data: recentTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('date', { ascending: false })
      .limit(5);

    if (recentTx) {
      setTransactions(
        recentTx.map((t) => ({
          id: t.id,
          description: t.description || 'Ohne Beschreibung',
          amount: Number(t.amount),
          type: t.type as 'income' | 'expense',
          date: t.date,
          category: t.category || undefined,
        }))
      );
    }
  };

  const createCompany = async () => {
    if (!newCompanyName.trim() || !user) return;

    setCreatingCompany(true);
    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: newCompanyName.trim() })
        .select()
        .single();

      if (companyError) throw companyError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      await refetchCompanies();
      setNewCompanyName('');
      setDialogOpen(false);
    } catch (error) {
      console.error('Error creating company:', error);
    } finally {
      setCreatingCompany(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Show onboarding if no companies
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 rounded-full bg-primary/10 mb-6">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Willkommen bei Fintutto!</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Erstellen Sie Ihre erste Firma, um mit der Buchhaltung zu beginnen.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Firma erstellen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Firma erstellen</DialogTitle>
              <DialogDescription>
                Geben Sie den Namen Ihrer Firma ein, um zu beginnen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Firmenname</Label>
                <Input
                  id="companyName"
                  placeholder="z.B. Musterfirma GmbH"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              </div>
              <Button
                onClick={createCompany}
                disabled={!newCompanyName.trim() || creatingCompany}
                className="w-full"
              >
                {creatingCompany ? 'Wird erstellt...' : 'Firma erstellen'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Übersicht für {currentCompany?.name || 'Ihre Firma'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Bankguthaben"
          value={formatCurrency(stats.bankBalance)}
          icon={Wallet}
        />
        <KPICard
          title="Einnahmen (Monat)"
          value={formatCurrency(stats.income)}
          change="+12%"
          changeType="positive"
          icon={TrendingUp}
        />
        <KPICard
          title="Ausgaben (Monat)"
          value={formatCurrency(stats.expenses)}
          change="-5%"
          changeType="positive"
          icon={TrendingDown}
        />
        <KPICard
          title="Gewinn (Monat)"
          value={formatCurrency(stats.profit)}
          change={stats.profit >= 0 ? '+8%' : '-8%'}
          changeType={stats.profit >= 0 ? 'positive' : 'negative'}
          icon={PiggyBank}
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions transactions={transactions} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
