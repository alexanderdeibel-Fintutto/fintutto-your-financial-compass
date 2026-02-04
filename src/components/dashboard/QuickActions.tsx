import { Plus, Upload, FileText, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Schnellaktionen</h3>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/50">
          <Plus className="h-5 w-5" />
          <span className="text-xs">Buchung</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/50">
          <FileText className="h-5 w-5" />
          <span className="text-xs">Rechnung</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/50">
          <Upload className="h-5 w-5" />
          <span className="text-xs">Beleg</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:bg-primary/10 hover:border-primary/50">
          <Receipt className="h-5 w-5" />
          <span className="text-xs">Export</span>
        </Button>
      </div>
    </div>
  );
}
