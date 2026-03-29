import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, Loader2, TrendingUp, AlertTriangle, Lightbulb,
  RefreshCw, Sparkles, User, ChevronDown, X, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'tip' | 'anomaly' | 'suggestion';
}

interface Anomaly {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
}

interface QuickPrompt {
  label: string;
  prompt: string;
  icon: React.ElementType;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: 'Finanzübersicht', prompt: 'Gib mir eine kurze Zusammenfassung meiner aktuellen Finanzsituation.', icon: TrendingUp },
  { label: 'Steuer-Tipps', prompt: 'Welche steuerlichen Optimierungsmöglichkeiten habe ich als Unternehmer?', icon: Lightbulb },
  { label: 'Anomalien prüfen', prompt: 'Analysiere meine Buchungen auf ungewöhnliche Ausgaben oder Muster.', icon: AlertTriangle },
  { label: 'Buchungsvorschlag', prompt: 'Schlage mir die richtige SKR03-Buchung für eine Bewirtungsrechnung vor.', icon: FileText },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);

function buildSystemPrompt(context: {
  companyName: string;
  bankBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  openInvoicesCount: number;
  openInvoicesSum: number;
  topCategories: { name: string; amount: number }[];
}): string {
  return `Du bist ein professioneller KI-Finanzassistent für das Unternehmen "${context.companyName}".
Du hast Zugriff auf folgende aktuelle Finanzdaten:

- Kontostand: ${fmt(context.bankBalance)}
- Einnahmen letzter Monat: ${fmt(context.monthlyIncome)}
- Ausgaben letzter Monat: ${fmt(context.monthlyExpense)}
- Monatsergebnis: ${fmt(context.monthlyIncome - context.monthlyExpense)}
- Offene Rechnungen: ${context.openInvoicesCount} Stück, Summe: ${fmt(context.openInvoicesSum)}
- Top-Ausgabenkategorien: ${context.topCategories.map((c) => `${c.name}: ${fmt(c.amount)}`).join(', ')}

Antworte auf Deutsch. Sei präzise, professionell und praxisorientiert.
Gib konkrete Handlungsempfehlungen. Verweise bei steuerlichen Fragen immer darauf, 
dass ein Steuerberater konsultiert werden sollte.
Formatiere Antworten klar mit Absätzen. Keine übermäßigen Emojis.`;
}

export default function AIAssistant() {
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [financialContext, setFinancialContext] = useState<Parameters<typeof buildSystemPrompt>[0] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentCompany) {
      loadContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadContext = async () => {
    if (!currentCompany) return;
    setContextLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [bankRes, txRes, invoicesRes] = await Promise.all([
      supabase.from('bank_accounts').select('balance').eq('company_id', currentCompany.id),
      supabase.from('transactions').select('amount, type, category')
        .eq('company_id', currentCompany.id)
        .gte('date', monthStart).lte('date', monthEnd),
      supabase.from('invoices').select('amount, status')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'overdue']),
    ]);

    const bankBalance = bankRes.data?.reduce((s, a) => s + Number(a.balance || 0), 0) || 0;
    const txData = txRes.data || [];
    const monthlyIncome = txData.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const monthlyExpense = txData.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    // Top categories
    const catMap = new Map<string, number>();
    txData.filter((t) => t.type === 'expense').forEach((t) => {
      const cat = t.category || 'Sonstiges';
      catMap.set(cat, (catMap.get(cat) || 0) + Number(t.amount));
    });
    const topCategories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    const openInvoices = invoicesRes.data || [];
    const ctx = {
      companyName: currentCompany.name,
      bankBalance,
      monthlyIncome,
      monthlyExpense,
      openInvoicesCount: openInvoices.length,
      openInvoicesSum: openInvoices.reduce((s, i) => s + Number(i.amount), 0),
      topCategories,
    };
    setFinancialContext(ctx);
    setContextLoading(false);

    // Welcome message
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Guten Tag! Ich bin Ihr KI-Finanzassistent für **${currentCompany.name}**.\n\nAktueller Kontostand: **${fmt(bankBalance)}** | Monatsergebnis: **${fmt(monthlyIncome - monthlyExpense)}**\n\nWie kann ich Ihnen helfen? Stellen Sie mir eine Frage oder wählen Sie einen der Schnellzugriffe.`,
        timestamp: new Date(),
        type: 'text',
      }]);
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading || !financialContext) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: buildSystemPrompt(financialContext) },
            ...history,
            { role: 'user', content: messageText },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        type: 'text',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      // Fallback: rule-based responses
      const fallback = generateFallbackResponse(messageText, financialContext);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
        type: 'text',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, financialContext]);

  const detectAnomalies = useCallback(async () => {
    if (!currentCompany) return;
    setAnomalyLoading(true);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: txData } = await supabase
      .from('transactions')
      .select('id, description, amount, type, date, category')
      .eq('company_id', currentCompany.id)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .eq('type', 'expense')
      .order('amount', { ascending: false });

    if (!txData || txData.length === 0) {
      toast.info('Keine Transaktionen für Anomalie-Analyse gefunden.');
      setAnomalyLoading(false);
      return;
    }

    // Statistical anomaly detection
    const amounts = txData.map((t) => Number(t.amount));
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length);
    const threshold2 = mean + 2 * stdDev;
    const threshold3 = mean + 3 * stdDev;

    const detected: Anomaly[] = txData
      .filter((t) => Number(t.amount) > threshold2)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        description: t.description || 'Unbekannte Buchung',
        amount: Number(t.amount),
        date: t.date,
        category: t.category || undefined,
        severity: Number(t.amount) > threshold3 ? 'high' : 'medium',
        reason: `Betrag (${fmt(Number(t.amount))}) liegt ${Number(t.amount) > threshold3 ? 'weit' : ''} über dem Durchschnitt (${fmt(mean)}).`,
      }));

    setAnomalies(detected);
    if (detected.length === 0) {
      toast.success('Keine Anomalien gefunden – Buchungsmuster unauffällig.');
    }
    setAnomalyLoading(false);
  }, [currentCompany]);

  const clearChat = () => {
    setMessages([]);
    setAnomalies([]);
    loadContext();
  };

  if (!currentCompany) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Bitte wählen Sie eine Firma aus.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">KI-Finanzassistent</h1>
            <p className="text-xs text-muted-foreground">
              {contextLoading ? 'Lade Finanzdaten...' : `Analysiert ${currentCompany.name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={detectAnomalies} disabled={anomalyLoading}>
            {anomalyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="ml-1.5 hidden sm:inline">Anomalien</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={clearChat} title="Chat zurücksetzen">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Anomalien-Panel */}
      {anomalies.length > 0 && (
        <Card className="mb-3 shrink-0 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                {anomalies.length} Anomalie{anomalies.length > 1 ? 'n' : ''} erkannt
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAnomalies([])}>
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {anomalies.map((a) => (
              <div key={a.id} className={`flex items-start justify-between gap-2 p-2 rounded-lg text-xs ${a.severity === 'high' ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
                <div>
                  <p className="font-medium">{a.description}</p>
                  <p className="text-muted-foreground">{a.reason}</p>
                </div>
                <Badge variant={a.severity === 'high' ? 'destructive' : 'secondary'} className="shrink-0">
                  {fmt(a.amount)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`shrink-0 p-1.5 rounded-full h-8 w-8 flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content.split('**').map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 p-1.5 rounded-full h-8 w-8 flex items-center justify-center bg-secondary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Prompts */}
        <div className="px-4 py-2 border-t border-border">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_PROMPTS.map((qp) => {
              const Icon = qp.icon;
              return (
                <button key={qp.label} onClick={() => sendMessage(qp.prompt)}
                  disabled={loading || contextLoading}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors disabled:opacity-50">
                  <Icon className="h-3 w-3" />
                  {qp.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 pt-2 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Frage stellen... (z.B. Wie optimiere ich meine Steuerlast?)"
              disabled={loading || contextLoading}
              className="flex-1"
            />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim() || contextLoading} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            KI-Antworten ersetzen keine Steuerberatung. Bei steuerlichen Fragen Steuerberater konsultieren.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Fallback-Antworten ohne API-Key
function generateFallbackResponse(
  question: string,
  ctx: Parameters<typeof buildSystemPrompt>[0]
): string {
  const q = question.toLowerCase();
  const net = ctx.monthlyIncome - ctx.monthlyExpense;

  if (q.includes('übersicht') || q.includes('zusammenfassung') || q.includes('situation')) {
    return `**Finanzübersicht ${ctx.companyName}**\n\nKontostand: ${fmt(ctx.bankBalance)}\nEinnahmen (lfd. Monat): ${fmt(ctx.monthlyIncome)}\nAusgaben (lfd. Monat): ${fmt(ctx.monthlyExpense)}\nMonatsergebnis: ${fmt(net)}\n\nOffene Rechnungen: ${ctx.openInvoicesCount} (${fmt(ctx.openInvoicesSum)})\n\n${net > 0 ? '✓ Positiver Cashflow – solide Basis.' : '⚠ Negativer Cashflow – Ausgaben prüfen.'}`;
  }

  if (q.includes('steuer') || q.includes('optimier')) {
    return `**Steuerliche Optimierungsmöglichkeiten**\n\n1. **Betriebsausgaben vollständig erfassen** – Alle geschäftlichen Ausgaben als Betriebsausgaben buchen.\n2. **Investitionsabzugsbetrag (IAB)** – Bis zu 50 % geplanter Investitionen vorab abziehen (§ 7g EStG).\n3. **Geringwertige Wirtschaftsgüter** – Anschaffungen bis 800 € netto sofort abschreiben.\n4. **Bewirtungskosten** – 70 % abzugsfähig mit korrektem Beleg.\n5. **Homeoffice-Pauschale** – 6 €/Tag, max. 1.260 €/Jahr.\n\n*Hinweis: Steuerberater für individuelle Beratung konsultieren.*`;
  }

  if (q.includes('buchung') || q.includes('skr') || q.includes('konto')) {
    return `**SKR03-Buchungsvorschläge**\n\nBewirtungsrechnung:\n- Soll: 4650 (Bewirtungskosten) 70 %\n- Soll: 4654 (Nicht abzugsfähige Bewirtungskosten) 30 %\n- Haben: 1600 (Verbindlichkeiten)\n\nBüromaterial:\n- Soll: 4930 (Bürobedarf)\n- Haben: 1600\n\nGehalt:\n- Soll: 4100 (Löhne und Gehälter)\n- Haben: 1700 (Verbindlichkeiten Lohn)`;
  }

  if (q.includes('anomal') || q.includes('ungewöhnlich') || q.includes('auffällig')) {
    return `**Anomalie-Analyse**\n\nNutzen Sie den "Anomalien"-Button oben, um eine automatische statistische Analyse Ihrer Buchungen durchzuführen. Das System erkennt Ausreißer, die mehr als 2 Standardabweichungen vom Durchschnitt abweichen.\n\nTop-Ausgabenkategorien:\n${ctx.topCategories.map((c) => `• ${c.name}: ${fmt(c.amount)}`).join('\n')}`;
  }

  return `Ich analysiere Ihre Frage zu "${question}".\n\nBasierend auf Ihren Finanzdaten:\n- Kontostand: ${fmt(ctx.bankBalance)}\n- Monatsergebnis: ${fmt(net)}\n\nFür eine detaillierte KI-Analyse konfigurieren Sie bitte den OpenAI API-Key in den Einstellungen. Ich beantworte Ihre Fragen dann mit vollständiger GPT-4-Intelligenz.`;
}
