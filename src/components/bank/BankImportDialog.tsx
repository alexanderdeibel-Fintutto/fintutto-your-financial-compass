 import { useState, useCallback } from 'react';
 import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
 import { supabase } from '@/integrations/supabase/client';
 import { useCompany } from '@/contexts/CompanyContext';
 import { useToast } from '@/hooks/use-toast';
 import {
   BankTransaction,
   BankFormat,
   BANK_FORMATS,
   parseCSV,
   parseMT940,
   parseCAMT053,
   detectFileFormat,
 } from '@/services/bankImport';
 
 interface BankAccount {
   id: string;
   name: string;
   iban: string | null;
 }
 
 interface BankImportDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   accounts: BankAccount[];
   onSuccess: () => void;
 }
 
 export function BankImportDialog({ open, onOpenChange, accounts, onSuccess }: BankImportDialogProps) {
   const { currentCompany } = useCompany();
   const { toast } = useToast();
 
   const [selectedAccountId, setSelectedAccountId] = useState<string>('');
   const [bankFormat, setBankFormat] = useState<BankFormat>('general');
   const [file, setFile] = useState<File | null>(null);
   const [parsedTransactions, setParsedTransactions] = useState<BankTransaction[]>([]);
   const [importing, setImporting] = useState(false);
   const [parseError, setParseError] = useState<string | null>(null);
   const [step, setStep] = useState<'upload' | 'preview'>('upload');
 
   const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (!selectedFile) return;
 
     setFile(selectedFile);
     setParseError(null);
 
     try {
       const content = await selectedFile.text();
       const fileFormat = detectFileFormat(content, selectedFile.name);
       
       let transactions: BankTransaction[] = [];
       
       if (fileFormat === 'mt940') {
         transactions = parseMT940(content);
       } else if (fileFormat === 'camt053') {
         transactions = parseCAMT053(content);
       } else {
         transactions = parseCSV(content, bankFormat);
       }
 
       if (transactions.length === 0) {
         setParseError('Keine Transaktionen gefunden. Bitte überprüfen Sie das Dateiformat.');
         return;
       }
 
       setParsedTransactions(transactions);
       setStep('preview');
     } catch (error) {
       console.error('Parse error:', error);
       setParseError('Fehler beim Lesen der Datei. Bitte überprüfen Sie das Format.');
     }
   }, [bankFormat]);
 
   const handleImport = async () => {
     if (!currentCompany || !selectedAccountId || parsedTransactions.length === 0) {
       toast({
         title: 'Fehler',
         description: 'Bitte wählen Sie ein Konto und laden Sie eine Datei hoch.',
         variant: 'destructive',
       });
       return;
     }
 
     setImporting(true);
     try {
       const transactionsToInsert = parsedTransactions.map((t) => ({
         company_id: currentCompany.id,
         bank_account_id: selectedAccountId,
         date: t.date || new Date().toISOString().split('T')[0],
         type: t.amount >= 0 ? 'income' : 'expense',
         amount: Math.abs(t.amount),
         description: t.description || t.counterpartName || 'Importierte Buchung',
         category: t.amount >= 0 ? 'Einnahmen' : 'Sonstiges',
       }));
 
       const { error } = await supabase
         .from('transactions')
         .insert(transactionsToInsert);
 
       if (error) throw error;
 
       toast({
         title: 'Import erfolgreich',
         description: `${parsedTransactions.length} Transaktionen wurden importiert.`,
       });
 
       onSuccess();
       resetForm();
       onOpenChange(false);
     } catch (error) {
       console.error('Import error:', error);
       toast({
         title: 'Fehler',
         description: 'Transaktionen konnten nicht importiert werden.',
         variant: 'destructive',
       });
     } finally {
       setImporting(false);
     }
   };
 
   const resetForm = () => {
     setSelectedAccountId('');
     setBankFormat('general');
     setFile(null);
     setParsedTransactions([]);
     setParseError(null);
     setStep('upload');
   };
 
   const formatCurrency = (amount: number) => {
     return new Intl.NumberFormat('de-DE', {
       style: 'currency',
       currency: 'EUR',
     }).format(amount);
   };
 
   const totalAmount = parsedTransactions.reduce((sum, t) => sum + t.amount, 0);
   const incomeCount = parsedTransactions.filter((t) => t.amount >= 0).length;
   const expenseCount = parsedTransactions.filter((t) => t.amount < 0).length;
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle>Kontoauszug importieren</DialogTitle>
         </DialogHeader>
 
         {step === 'upload' ? (
           <div className="space-y-6">
             {/* Account Selection */}
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Zielkonto</Label>
                 <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Konto auswählen..." />
                   </SelectTrigger>
                   <SelectContent>
                     {accounts.map((account) => (
                       <SelectItem key={account.id} value={account.id}>
                         {account.name} {account.iban ? `(${account.iban.slice(-4)})` : ''}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div>
                 <Label>Bank-Format</Label>
                 <Select value={bankFormat} onValueChange={(v) => setBankFormat(v as BankFormat)}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {BANK_FORMATS.map((format) => (
                       <SelectItem key={format.value} value={format.value}>
                         {format.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             {/* File Upload */}
             <div>
               <Label>Datei hochladen</Label>
               <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                 <input
                   type="file"
                   accept=".csv,.txt,.sta,.mt940,.xml"
                   onChange={handleFileChange}
                   className="hidden"
                   id="bank-file-upload"
                 />
                 <label htmlFor="bank-file-upload" className="cursor-pointer">
                   <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                   <p className="text-lg font-medium mb-1">
                     {file ? file.name : 'Datei auswählen oder hier ablegen'}
                   </p>
                   <p className="text-sm text-muted-foreground">
                     Unterstützte Formate: CSV, MT940, CAMT.053
                   </p>
                 </label>
               </div>
             </div>
 
             {parseError && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Fehler</AlertTitle>
                 <AlertDescription>{parseError}</AlertDescription>
               </Alert>
             )}
 
             {/* Format Info */}
             <Alert>
               <FileText className="h-4 w-4" />
               <AlertTitle>Hinweis zum Dateiformat</AlertTitle>
               <AlertDescription>
                 Laden Sie die Kontoauszüge direkt aus Ihrem Online-Banking herunter. 
                 MT940 und CAMT.053 Formate werden automatisch erkannt.
               </AlertDescription>
             </Alert>
           </div>
         ) : (
           <div className="space-y-4">
             {/* Summary */}
             <div className="grid grid-cols-3 gap-4">
               <div className="glass rounded-lg p-4 text-center">
                 <p className="text-sm text-muted-foreground">Transaktionen</p>
                 <p className="text-2xl font-bold">{parsedTransactions.length}</p>
               </div>
               <div className="glass rounded-lg p-4 text-center">
                 <p className="text-sm text-muted-foreground">Einnahmen / Ausgaben</p>
                 <p className="text-2xl font-bold">
                   <span className="text-success">{incomeCount}</span>
                   {' / '}
                   <span className="text-destructive">{expenseCount}</span>
                 </p>
               </div>
               <div className="glass rounded-lg p-4 text-center">
                 <p className="text-sm text-muted-foreground">Saldo</p>
                 <p className={`text-2xl font-bold ${totalAmount >= 0 ? 'text-success' : 'text-destructive'}`}>
                   {formatCurrency(totalAmount)}
                 </p>
               </div>
             </div>
 
             {/* Preview Table */}
             <div className="border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Datum</TableHead>
                     <TableHead>Beschreibung</TableHead>
                     <TableHead>Gegenpartei</TableHead>
                     <TableHead className="text-right">Betrag</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {parsedTransactions.slice(0, 50).map((transaction, index) => (
                     <TableRow key={index}>
                       <TableCell className="font-mono text-sm">
                         {transaction.date}
                       </TableCell>
                       <TableCell className="max-w-[250px] truncate">
                         {transaction.description}
                       </TableCell>
                       <TableCell className="max-w-[150px] truncate">
                         {transaction.counterpartName || '-'}
                       </TableCell>
                       <TableCell className={`text-right font-medium ${transaction.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                         {formatCurrency(transaction.amount)}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
             {parsedTransactions.length > 50 && (
               <p className="text-sm text-muted-foreground text-center">
                 ... und {parsedTransactions.length - 50} weitere Transaktionen
               </p>
             )}
 
             <Alert>
               <CheckCircle2 className="h-4 w-4" />
               <AlertTitle>Bereit zum Importieren</AlertTitle>
               <AlertDescription>
                 Die Transaktionen werden als neue Buchungen angelegt und dem ausgewählten Konto zugeordnet.
               </AlertDescription>
             </Alert>
           </div>
         )}
 
         <DialogFooter className="mt-6">
           {step === 'preview' && (
             <Button variant="outline" onClick={() => setStep('upload')}>
               Zurück
             </Button>
           )}
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Abbrechen
           </Button>
           {step === 'preview' && (
             <Button onClick={handleImport} disabled={importing}>
               {importing ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Importiert...
                 </>
               ) : (
                 <>
                   <Upload className="h-4 w-4 mr-2" />
                   {parsedTransactions.length} Transaktionen importieren
                 </>
               )}
             </Button>
           )}
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }