import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export type AdvisorAccessStatus = 'active' | 'expired' | 'revoked';

export interface TaxAdvisorAccess {
  id: string;
  company_id: string;
  advisor_name: string;
  advisor_email: string;
  firm_name?: string;
  access_code: string;
  status: AdvisorAccessStatus;
  permissions: AdvisorPermissions;
  created_at: string;
  expires_at: string;
  last_access_at?: string;
  access_count: number;
}

export interface AdvisorPermissions {
  view_transactions: boolean;
  view_invoices: boolean;
  view_receipts: boolean;
  view_reports: boolean;
  export_datev: boolean;
  export_gdpdu: boolean;
  view_bank_accounts: boolean;
  view_contacts: boolean;
}

export interface AdvisorActivity {
  id: string;
  access_id: string;
  action: 'login' | 'view_report' | 'export_datev' | 'export_gdpdu' | 'view_transactions' | 'view_invoices' | 'download' | 'view_reports' | 'logout';
  details?: string;
  ip_address?: string;
  created_at: string;
  timestamp?: string;
}

export interface PortalSettings {
  company_id: string;
  portal_enabled: boolean;
  require_2fa: boolean;
  auto_expire_days: number;
  notification_on_access: boolean;
  allowed_ip_ranges?: string[];
}



// Generate a random access code
function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useTaxAdvisorPortal() {
  const { currentCompany } = useCompany();
  const [accessList, setAccessList] = useState<TaxAdvisorAccess[]>([]);
  const [activityLog, setActivityLog] = useState<AdvisorActivity[]>([]);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Daten aus Supabase laden
  const loadData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      // Zugänge laden
      const { data: accessData } = await supabase
        .from('tax_advisor_access')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      if (accessData) setAccessList(accessData as TaxAdvisorAccess[]);

      // Aktivitätslog laden
      if (accessData && accessData.length > 0) {
        const accessIds = accessData.map((a: any) => a.id);
        const { data: logData } = await supabase
          .from('tax_advisor_activity_log')
          .select('*')
          .in('access_id', accessIds)
          .order('created_at', { ascending: false })
          .limit(100);
        if (logData) setActivityLog(logData as AdvisorActivity[]);
      }

      // Einstellungen laden
      const { data: settingsData } = await supabase
        .from('tax_advisor_portal_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (settingsData) {
        setSettings(settingsData as PortalSettings);
      } else {
        const defaultSettings = getDefaultSettings(currentCompany.id);
        const { data: newSettings } = await supabase
          .from('tax_advisor_portal_settings')
          .insert(defaultSettings)
          .select()
          .single();
        if (newSettings) setSettings(newSettings as PortalSettings);
        else setSettings(defaultSettings);
      }
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);



  // Neuen Berater-Zugang anlegen
  const createAccess = useCallback(async (
    data: Pick<TaxAdvisorAccess, 'advisor_name' | 'advisor_email' | 'firm_name' | 'permissions'>,
    expiresInDays: number = 365
  ) => {
    if (!currentCompany) return null;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: newAccess, error } = await supabase
      .from('tax_advisor_access')
      .insert({
        company_id: currentCompany.id,
        advisor_name: data.advisor_name,
        advisor_email: data.advisor_email,
        firm_name: data.firm_name || null,
        access_code: generateAccessCode(),
        status: 'active',
        permissions: data.permissions,
        expires_at: expiresAt,
      })
      .select()
      .single();
    if (error) { console.error('createAccess error:', error); return null; }
    setAccessList((prev) => [newAccess as TaxAdvisorAccess, ...prev]);
    return newAccess as TaxAdvisorAccess;
  }, [currentCompany]);

  // Zugang widerrufen
  const revokeAccess = useCallback(async (accessId: string) => {
    const { error } = await supabase
      .from('tax_advisor_access')
      .update({ status: 'revoked' })
      .eq('id', accessId);
    if (!error) {
      setAccessList((prev) =>
        prev.map((a) => (a.id === accessId ? { ...a, status: 'revoked' as AdvisorAccessStatus } : a))
      );
    }
  }, []);

  // Zugang verlängern
  const extendAccess = useCallback(async (accessId: string, additionalDays: number) => {
    const access = accessList.find((a) => a.id === accessId);
    if (!access) return;
    const newExpiry = new Date(new Date(access.expires_at).getTime() + additionalDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('tax_advisor_access')
      .update({ expires_at: newExpiry, status: 'active' })
      .eq('id', accessId);
    if (!error) {
      setAccessList((prev) =>
        prev.map((a) => (a.id === accessId ? { ...a, expires_at: newExpiry, status: 'active' as AdvisorAccessStatus } : a))
      );
    }
  }, [accessList]);

  // Access-Code neu generieren
  const regenerateCode = useCallback(async (accessId: string) => {
    const newCode = generateAccessCode();
    const { error } = await supabase
      .from('tax_advisor_access')
      .update({ access_code: newCode })
      .eq('id', accessId);
    if (!error) {
      setAccessList((prev) =>
        prev.map((a) => (a.id === accessId ? { ...a, access_code: newCode } : a))
      );
      return newCode;
    }
    return null;
  }, []);

  // Berechtigungen aktualisieren
  const updatePermissions = useCallback(async (accessId: string, permissions: AdvisorPermissions) => {
    const { error } = await supabase
      .from('tax_advisor_access')
      .update({ permissions })
      .eq('id', accessId);
    if (!error) {
      setAccessList((prev) =>
        prev.map((a) => (a.id === accessId ? { ...a, permissions } : a))
      );
    }
  }, []);

  // Aktivität loggen
  const logActivity = useCallback(async (accessId: string, action: AdvisorActivity['action'], details?: string) => {
    const { data: newLog } = await supabase
      .from('tax_advisor_activity_log')
      .insert({ access_id: accessId, action, details })
      .select()
      .single();
    if (newLog) {
      setActivityLog((prev) => [newLog as AdvisorActivity, ...prev].slice(0, 100));
    }
    // access_count und last_access_at aktualisieren
    await supabase
      .from('tax_advisor_access')
      .update({ access_count: (accessList.find(a => a.id === accessId)?.access_count || 0) + 1, last_access_at: new Date().toISOString() })
      .eq('id', accessId);
    setAccessList((prev) =>
      prev.map((a) =>
        a.id === accessId
          ? { ...a, access_count: a.access_count + 1, last_access_at: new Date().toISOString() }
          : a
      )
    );
  }, [accessList]);

  // Get activity for a specific access
  const getActivityForAccess = useCallback((accessId: string) => {
    return activityLog.filter(a => a.access_id === accessId);
  }, [activityLog]);

  // Get statistics
  const getStats = useCallback(() => {
    const activeAccess = accessList.filter(a => a.status === 'active');
    const expiredAccess = accessList.filter(a =>
      a.status === 'active' && new Date(a.expires_at) < new Date()
    );

    return {
      totalAdvisors: accessList.length,
      activeAdvisors: activeAccess.length - expiredAccess.length,
      totalLogins: accessList.reduce((sum, a) => sum + a.access_count, 0),
      recentActivity: activityLog.slice(0, 5),
    };
  }, [accessList, activityLog]);

  // Check if access is valid
  const isAccessValid = useCallback((accessId: string) => {
    const access = accessList.find(a => a.id === accessId);
    if (!access) return false;
    if (access.status !== 'active') return false;
    if (new Date(access.expires_at) < new Date()) return false;
    return true;
  }, [accessList]);

  // Einstellungen speichern
  const updateSettings = useCallback(async (newSettings: PortalSettings) => {
    if (!currentCompany) return;
    const { error } = await supabase
      .from('tax_advisor_portal_settings')
      .upsert({ ...newSettings, company_id: currentCompany.id });
    if (!error) setSettings(newSettings);
  }, [currentCompany]);

  return {
    accessList,
    activityLog,
    settings,
    loading,
    createAccess,
    revokeAccess,
    extendAccess,
    regenerateCode,
    updatePermissions,
    updateSettings,
    logActivity,
    getActivityForAccess,
    getStats,
    isAccessValid,
    reload: loadData,
  };
}

function getDefaultSettings(companyId: string): PortalSettings {
  return {
    company_id: companyId,
    portal_enabled: true,
    require_2fa: false,
    auto_expire_days: 365,
    notification_on_access: true,
  };
}
