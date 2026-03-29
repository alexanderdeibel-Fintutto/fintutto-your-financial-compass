/**
 * TaxDeadlineWidget – Steuerfristen-Countdown für das Dashboard
 */
import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface TaxDeadline {
  name: string;
  date: Date;
  type: 'ustva' | 'koerperschaft' | 'gewerbe' | 'einkommensteuer' | 'lohnsteuer' | 'sonstige';
  daysLeft: number;
}

function getUpcomingDeadlines(): TaxDeadline[] {
  const now = new Date();
  const year = now.getFullYear();
  const deadlines: Omit<TaxDeadline, 'daysLeft'>[] = [
    // UStVA monatlich (10. des Folgemonats)
    ...Array.from({ length: 12 }, (_, i) => ({
      name: `UStVA ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][i]}`,
      date: new Date(year, i + 1, 10),
      type: 'ustva' as const,
    })),
    // Lohnsteuer-Anmeldung monatlich
    ...Array.from({ length: 12 }, (_, i) => ({
      name: `Lohnsteuer ${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][i]}`,
      date: new Date(year, i + 1, 10),
      type: 'lohnsteuer' as const,
    })),
    { name: 'Körperschaftsteuer', date: new Date(year, 6, 31), type: 'koerperschaft' },
    { name: 'Gewerbesteuer', date: new Date(year, 6, 31), type: 'gewerbe' },
    { name: 'Einkommensteuer', date: new Date(year, 6, 31), type: 'einkommensteuer' },
    { name: 'Jahresabschluss', date: new Date(year, 11, 31), type: 'sonstige' },
  ];

  return deadlines
    .map(d => ({
      ...d,
      daysLeft: Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter(d => d.daysLeft >= 0 && d.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);
}

const TYPE_COLORS: Record<string, string> = {
  ustva: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  lohnsteuer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  koerperschaft: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  gewerbe: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  einkommensteuer: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  sonstige: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export function TaxDeadlineWidget() {
  const navigate = useNavigate();
  const [deadlines] = useState<TaxDeadline[]>(getUpcomingDeadlines);

  if (deadlines.length === 0) {
    return (
      <Card className="col-span-full lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Steuerfristen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm">Keine Fristen in den nächsten 60 Tagen</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-1 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/steuer-assistent')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Steuerfristen
          {deadlines.some(d => d.daysLeft <= 7) && (
            <Badge variant="destructive" className="text-xs ml-auto">Dringend</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deadlines.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TYPE_COLORS[d.type]}`}>
                {d.type === 'ustva' ? 'UStVA' : d.type === 'lohnsteuer' ? 'LSt' : d.type === 'koerperschaft' ? 'KSt' : d.type === 'gewerbe' ? 'GewSt' : d.type === 'einkommensteuer' ? 'ESt' : 'Sonstig'}
              </div>
              <span className="text-xs truncate">{d.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {d.daysLeft <= 3 ? (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              ) : d.daysLeft <= 14 ? (
                <Clock className="h-3 w-3 text-orange-500" />
              ) : null}
              <span className={`text-xs font-bold ${d.daysLeft <= 3 ? 'text-red-600' : d.daysLeft <= 14 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                {d.daysLeft === 0 ? 'Heute!' : `${d.daysLeft}d`}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
