import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Company {
  id: string;
  name: string;
  tax_id?: string;
  address?: string;
  street?: string;
  postal_code?: string;
  legal_form?: string;
  vat_id?: string;
  zip?: string;
  city?: string;
  chart_of_accounts?: string;
  is_personal?: boolean;
  theme_index?: number;
  // Erweiterte Felder aus Migration 20260326000001
  register_number?: string;
  register_court?: string;
  managing_director?: string;
  is_managing_director?: boolean;
  ownership_percentage?: number;
  company_type?: string; // 'freelancer' | 'gmbh' | 'beteiligung' | 'gf_mandat'
  primary_iban?: string;
  primary_bic?: string;
  primary_bank_name?: string;
  logo_url?: string;
  small_business_regulation?: boolean;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  fiscal_year_start?: string;
}

const COMPANY_SELECT = [
  'id', 'name', 'tax_id', 'address', 'street', 'postal_code',
  'legal_form', 'vat_id', 'zip', 'city', 'chart_of_accounts',
  'is_personal', 'theme_index',
  'register_number', 'register_court', 'managing_director',
  'is_managing_director', 'ownership_percentage', 'company_type',
  'primary_iban', 'primary_bic', 'primary_bank_name', 'logo_url',
  'small_business_regulation', 'onboarding_completed', 'onboarding_step',
  'fiscal_year_start',
].join(', ');

interface CompanyContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  personalCompany: Company | null;
  businessCompanies: Company[];
  loading: boolean;
  refetchCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const ensurePersonalCompany = async (): Promise<Company | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mein';
      
      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert({ name: `${displayName} – Privat`, is_personal: true })
        .select(COMPANY_SELECT)
        .single();

      if (error) {
        console.error('Error creating personal company:', error);
        return null;
      }

      return newCompany as Company;
    } catch (error) {
      console.error('Error ensuring personal company:', error);
      return null;
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data: memberships } = await supabase
        .from('company_members')
        .select('company_id');

      let companiesData: Company[] = [];

      if (memberships && memberships.length > 0) {
        const companyIds = memberships.map(m => m.company_id);
        const { data } = await supabase
          .from('companies')
          .select(COMPANY_SELECT)
          .in('id', companyIds);

        companiesData = (data || []) as Company[];
      }

      // Check if personal company exists, create if not
      const hasPersonal = companiesData.some(c => c.is_personal);
      if (!hasPersonal) {
        const personalCompany = await ensurePersonalCompany();
        if (personalCompany) {
          companiesData.push(personalCompany);
        }
      }

      // Sort: personal first, then alphabetical
      const sorted = [...companiesData].sort((a, b) => {
        if (a.is_personal && !b.is_personal) return -1;
        if (!a.is_personal && b.is_personal) return 1;
        return a.name.localeCompare(b.name);
      });

      setCompanies(sorted);

      // Restore last selected company from localStorage
      const savedId = localStorage.getItem('fintutto_current_company_id');
      if (!currentCompany) {
        const saved = savedId ? sorted.find(c => c.id === savedId) : null;
        const personal = sorted.find(c => c.is_personal);
        setCurrentCompany(saved || personal || sorted[0] || null);
      } else {
        // Refresh currentCompany data
        const refreshed = sorted.find(c => c.id === currentCompany.id);
        if (refreshed) setCurrentCompany(refreshed);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentCompany = (company: Company | null) => {
    setCurrentCompany(company);
    if (company) {
      localStorage.setItem('fintutto_current_company_id', company.id);
    } else {
      localStorage.removeItem('fintutto_current_company_id');
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const personalCompany = companies.find(c => c.is_personal) || null;
  const businessCompanies = companies.filter(c => !c.is_personal);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        currentCompany,
        setCurrentCompany: handleSetCurrentCompany,
        personalCompany,
        businessCompanies,
        loading,
        refetchCompanies: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
