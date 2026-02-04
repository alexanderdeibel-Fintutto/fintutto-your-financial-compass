import { BarChart3, FileDown, Calendar, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCompany } from '@/contexts/CompanyContext';

const reportTypes = [
  {
    title: 'Einnahmen-Übersicht',
    description: 'Detaillierte Aufstellung aller Einnahmen',
    icon: TrendingUp,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    title: 'Ausgaben-Übersicht',
    description: 'Analyse aller Ausgaben nach Kategorie',
    icon: TrendingDown,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  {
    title: 'Gewinn & Verlust',
    description: 'GuV-Rechnung für den gewählten Zeitraum',
    icon: BarChart3,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: 'Umsatzsteuer',
    description: 'USt-Voranmeldung und Übersicht',
    icon: PieChart,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    title: 'Kontoauszüge',
    description: 'Bankbewegungen exportieren',
    icon: Calendar,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    title: 'Jahresabschluss',
    description: 'Jahresübersicht und Bilanzdaten',
    icon: FileDown,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

export default function Reports() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Bitte wählen Sie eine Firma aus.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Berichte</h1>
          <p className="text-muted-foreground">Finanzberichte und Auswertungen</p>
        </div>
        <Button variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          Zeitraum wählen
        </Button>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => (
          <Card
            key={report.title}
            className="glass border-border/50 hover:bg-secondary/30 transition-all duration-300 cursor-pointer group"
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${report.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                  <report.icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <CardDescription className="mt-1">{report.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Anzeigen
                </Button>
                <Button variant="ghost" size="sm">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Schnellübersicht</h3>
        <p className="text-muted-foreground">
          Wählen Sie einen Bericht aus, um detaillierte Auswertungen für {currentCompany.name} zu erstellen.
        </p>
      </div>
    </div>
  );
}
