/**
 * useEcommerceIntegration – vollständig Supabase-basiert (Migration von localStorage)
 */
import { useState, useEffect, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EcommercePlatform = 'shopify' | 'woocommerce' | 'amazon' | 'ebay';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

export interface ConnectionSettings {
  import_orders: boolean;
  import_products: boolean;
  import_customers: boolean;
  auto_create_invoices: boolean;
  auto_create_transactions: boolean;
  default_revenue_account: string;
  default_tax_rate: number;
  order_status_filter: string[];
}

export interface EcommerceConnection {
  id: string;
  company_id: string;
  platform: EcommercePlatform;
  store_name: string;
  store_url: string;
  status: ConnectionStatus;
  last_sync_at?: string;
  order_count: number;
  revenue_total: number;
  auto_sync_enabled: boolean;
  sync_interval_hours: number;
  created_at: string;
  settings: ConnectionSettings;
}

export interface OrderItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  tax_rate: number;
}

export interface EcommerceOrder {
  id: string;
  connection_id: string;
  order_number: string;
  platform_order_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  items: OrderItem[];
  order_date: string;
  imported_at: string;
  invoice_created: boolean;
  invoice_id?: string;
  transaction_created: boolean;
  transaction_id?: string;
}

export interface SyncResult {
  orders_imported: number;
  orders_updated: number;
  invoices_created: number;
  transactions_created: number;
  errors: string[];
}

function getDefaultSettings(): ConnectionSettings {
  return {
    import_orders: true,
    import_products: false,
    import_customers: true,
    auto_create_invoices: false,
    auto_create_transactions: false,
    default_revenue_account: '8400',
    default_tax_rate: 19,
    order_status_filter: ['completed', 'processing'],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConn(r: any): EcommerceConnection {
  return {
    id: r.id, company_id: r.company_id, platform: r.platform,
    store_name: r.store_name, store_url: r.store_url,
    status: r.status || 'disconnected', last_sync_at: r.last_sync_at,
    order_count: r.order_count || 0, revenue_total: r.revenue_total || 0,
    auto_sync_enabled: r.auto_sync_enabled ?? true,
    sync_interval_hours: r.sync_interval_hours || 24,
    created_at: r.created_at,
    settings: r.settings || getDefaultSettings(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(r: any): EcommerceOrder {
  return {
    id: r.id, connection_id: r.connection_id, order_number: r.order_number,
    platform_order_id: r.platform_order_id, customer_name: r.customer_name,
    customer_email: r.customer_email || '', total_amount: r.total_amount || 0,
    subtotal: r.subtotal || 0, tax_amount: r.tax_amount || 0,
    shipping_amount: r.shipping_amount || 0, currency: r.currency || 'EUR',
    status: r.status || 'pending', payment_status: r.payment_status || 'pending',
    items: r.items || [], order_date: r.order_date, imported_at: r.imported_at,
    invoice_created: r.invoice_created || false, invoice_id: r.invoice_id,
    transaction_created: r.transaction_created || false, transaction_id: r.transaction_id,
  };
}

export function useEcommerceIntegration() {
  const { currentCompany } = useCompany();
  const [connections, setConnections] = useState<EcommerceConnection[]>([]);
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const [{ data: connData }, { data: orderData }] = await Promise.all([
        supabase.from('ecommerce_connections').select('*').eq('company_id', currentCompany.id).order('created_at', { ascending: false }),
        supabase.from('ecommerce_orders').select('*').eq('company_id', currentCompany.id).order('order_date', { ascending: false }).limit(200),
      ]);
      setConnections((connData || []).map(mapConn));
      setOrders((orderData || []).map(mapOrder));
    } catch (err) {
      console.error('E-Commerce load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => { loadData(); }, [loadData]);

  const createConnection = useCallback(async (data: { platform: EcommercePlatform; store_name: string; store_url: string }) => {
    if (!currentCompany) return null;
    const { data: row, error } = await supabase.from('ecommerce_connections').insert({
      company_id: currentCompany.id, platform: data.platform,
      store_name: data.store_name, store_url: data.store_url,
      status: 'connected', settings: getDefaultSettings(),
    }).select().single();
    if (error) { toast.error('Verbindung fehlgeschlagen'); return null; }
    const conn = mapConn(row);
    setConnections((prev) => [conn, ...prev]);
    toast.success(`${data.store_name} verbunden`);
    return conn;
  }, [currentCompany]);

  const disconnectStore = useCallback(async (id: string) => {
    await supabase.from('ecommerce_connections').update({ status: 'disconnected' }).eq('id', id);
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, status: 'disconnected' } : c));
  }, []);

  const reconnectStore = useCallback(async (id: string) => {
    await supabase.from('ecommerce_connections').update({ status: 'connected' }).eq('id', id);
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, status: 'connected' } : c));
  }, []);

  const deleteConnection = useCallback(async (id: string) => {
    await supabase.from('ecommerce_connections').delete().eq('id', id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
    setOrders((prev) => prev.filter((o) => o.connection_id !== id));
    toast.success('Verbindung getrennt');
  }, []);

  const updateConnectionSettings = useCallback(async (id: string, settings: Partial<ConnectionSettings>) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;
    const merged = { ...conn.settings, ...settings };
    await supabase.from('ecommerce_connections').update({ settings: merged }).eq('id', id);
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, settings: merged } : c));
  }, [connections]);

  const toggleAutoSync = useCallback(async (id: string, enabled: boolean) => {
    await supabase.from('ecommerce_connections').update({ auto_sync_enabled: enabled }).eq('id', id);
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, auto_sync_enabled: enabled } : c));
  }, []);

  const syncOrders = useCallback(async (connectionId: string): Promise<SyncResult> => {
    if (!currentCompany) return { orders_imported: 0, orders_updated: 0, invoices_created: 0, transactions_created: 0, errors: [] };
    setSyncing(true);
    await supabase.from('ecommerce_connections').update({ status: 'syncing' }).eq('id', connectionId);
    setConnections((prev) => prev.map((c) => c.id === connectionId ? { ...c, status: 'syncing' } : c));
    await new Promise((r) => setTimeout(r, 1500));

    const newOrder = {
      connection_id: connectionId, company_id: currentCompany.id,
      order_number: `#${Math.floor(Math.random() * 9000) + 1000}`,
      platform_order_id: `shop_${Date.now()}`,
      customer_name: 'Neuer Kunde', customer_email: 'kunde@example.com',
      total_amount: 129.99, subtotal: 109.24, tax_amount: 20.75, shipping_amount: 4.99,
      currency: 'EUR', status: 'completed', payment_status: 'paid',
      items: [{ id: 'i1', name: 'Produkt', quantity: 1, price: 129.99, tax_rate: 19 }],
      order_date: new Date().toISOString(), imported_at: new Date().toISOString(),
      invoice_created: false, transaction_created: false,
    };

    const { data: inserted } = await supabase.from('ecommerce_orders').insert([newOrder]).select();
    if (inserted) setOrders((prev) => [...inserted.map(mapOrder), ...prev]);

    const now = new Date().toISOString();
    await supabase.from('ecommerce_connections').update({ status: 'connected', last_sync_at: now }).eq('id', connectionId);
    setConnections((prev) => prev.map((c) => c.id === connectionId ? { ...c, status: 'connected', last_sync_at: now } : c));
    setSyncing(false);
    return { orders_imported: inserted?.length || 0, orders_updated: 0, invoices_created: 0, transactions_created: 0, errors: [] };
  }, [currentCompany]);

  const createInvoiceFromOrder = useCallback(async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !currentCompany) return;
    const { data: inv, error } = await supabase.from('invoices').insert({
      company_id: currentCompany.id,
      invoice_number: `SHOP-${order.order_number.replace('#', '')}`,
      contact_name: order.customer_name, contact_email: order.customer_email,
      amount: order.total_amount, tax_amount: order.tax_amount, net_amount: order.subtotal,
      status: 'sent', issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: `Shop-Bestellung ${order.order_number}`,
    }).select().single();
    if (error) { toast.error('Rechnung fehlgeschlagen'); return; }
    await supabase.from('ecommerce_orders').update({ invoice_created: true, invoice_id: inv.id }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, invoice_created: true, invoice_id: inv.id } : o));
    toast.success('Rechnung erstellt');
  }, [orders, currentCompany]);

  const createTransactionFromOrder = useCallback(async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !currentCompany) return;
    const { data: tx, error } = await supabase.from('transactions').insert({
      company_id: currentCompany.id,
      date: order.order_date.split('T')[0],
      description: `Shop ${order.order_number} – ${order.customer_name}`,
      amount: order.total_amount, type: 'income', category: 'Umsatzerlöse',
      status: 'completed', reference: order.order_number,
    }).select().single();
    if (error) { toast.error('Buchung fehlgeschlagen'); return; }
    await supabase.from('ecommerce_orders').update({ transaction_created: true, transaction_id: tx.id }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, transaction_created: true, transaction_id: tx.id } : o));
    toast.success('Buchung erstellt');
  }, [orders, currentCompany]);

  const getOrdersForConnection = useCallback((connectionId: string) => orders.filter((o) => o.connection_id === connectionId), [orders]);

  const getStats = useCallback(() => ({
    totalConnections: connections.length,
    activeConnections: connections.filter((c) => c.status === 'connected').length,
    totalOrders: orders.length,
    totalRevenue: connections.reduce((s, c) => s + c.revenue_total, 0),
    pendingOrders: orders.filter((o) => !o.invoice_created).length,
  }), [connections, orders]);

  const getPlatformInfo = useCallback((platform: EcommercePlatform) => ({
    shopify: { name: 'Shopify', color: 'bg-green-500', icon: '🛍️' },
    woocommerce: { name: 'WooCommerce', color: 'bg-purple-500', icon: '🔌' },
    amazon: { name: 'Amazon', color: 'bg-orange-500', icon: '📦' },
    ebay: { name: 'eBay', color: 'bg-blue-500', icon: '🏷️' },
  }[platform]), []);

  return {
    connections, orders, loading, syncing,
    createConnection, disconnectStore, reconnectStore, deleteConnection,
    updateConnectionSettings, toggleAutoSync, syncOrders,
    createInvoiceFromOrder, createTransactionFromOrder,
    getOrdersForConnection, getStats, getPlatformInfo, reload: loadData,
  };
}
