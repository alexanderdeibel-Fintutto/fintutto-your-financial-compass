import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export type SepaPaymentType = 'transfer' | 'direct_debit';
export type SepaPaymentStatus = 'draft' | 'pending' | 'exported' | 'executed' | 'failed';

export interface SepaPayment {
  id: string;
  company_id: string;
  type: SepaPaymentType;
  status: SepaPaymentStatus;
  creditor_name: string;
  creditor_iban: string;
  creditor_bic?: string;
  amount: number;
  currency: string;
  reference: string;
  end_to_end_id: string;
  mandate_id?: string;
  mandate_date?: string;
  sequence_type?: 'FRST' | 'RCUR' | 'OOFF' | 'FNAL';
  execution_date: string;
  batch_id?: string;
  invoice_id?: string;
  contact_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SepaBatch {
  id: string;
  company_id: string;
  type: SepaPaymentType;
  status: 'open' | 'closed' | 'exported';
  message_id: string;
  payment_count: number;
  total_amount: number;
  execution_date: string;
  created_at: string;
  xml_content?: string;
}

interface SepaConfig {
  creditor_id: string;
  company_name: string;
  iban: string;
  bic: string;
}

export function useSepaPayments() {
  const { currentCompany } = useCompany();
  const [payments, setPayments] = useState<SepaPayment[]>([]);
  const [batches, setBatches] = useState<SepaBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    const [paymentsRes, batchesRes] = await Promise.all([
      supabase.from('sepa_payments').select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false }),
      supabase.from('sepa_batches').select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false }),
    ]);
    if (paymentsRes.data) setPayments(paymentsRes.data as SepaPayment[]);
    if (batchesRes.data) setBatches(batchesRes.data as SepaBatch[]);
    setLoading(false);
  }, [currentCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createPayment = useCallback(async (
    payment: Omit<SepaPayment, 'id' | 'company_id' | 'created_at' | 'updated_at'>
  ): Promise<SepaPayment | null> => {
    if (!currentCompany) return null;
    const { data, error } = await supabase.from('sepa_payments').insert({
      ...payment,
      company_id: currentCompany.id,
    }).select().single();
    if (error) { toast.error('Fehler beim Erstellen der Zahlung'); return null; }
    await loadData();
    return data as SepaPayment;
  }, [currentCompany, loadData]);

  const updatePaymentStatus = useCallback(async (paymentId: string, status: SepaPaymentStatus) => {
    const { error } = await supabase.from('sepa_payments')
      .update({ status })
      .eq('id', paymentId);
    if (error) { toast.error('Fehler beim Aktualisieren'); return; }
    await loadData();
  }, [loadData]);

  const deletePayment = useCallback(async (paymentId: string) => {
    const { error } = await supabase.from('sepa_payments').delete().eq('id', paymentId);
    if (error) { toast.error('Fehler beim Löschen'); return; }
    await loadData();
  }, [loadData]);

  const generateSepaXml = useCallback((
    type: SepaPaymentType,
    paymentIds: string[],
    config: SepaConfig
  ): string => {
    const selectedPayments = payments.filter(p => paymentIds.includes(p.id));
    const totalAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
    const messageId = `MSG-${Date.now()}`;
    const creationDateTime = new Date().toISOString();

    if (type === 'transfer') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${selectedPayments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(config.company_name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${Date.now()}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${selectedPayments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${selectedPayments[0]?.execution_date || new Date().toISOString().split('T')[0]}</ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(config.company_name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${config.iban}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${config.bic}</BIC></FinInstnId></DbtrAgt>
${selectedPayments.map(p => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${p.end_to_end_id}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${p.amount.toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId>${p.creditor_bic ? `<BIC>${p.creditor_bic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}</FinInstnId></CdtrAgt>
        <Cdtr><Nm>${escapeXml(p.creditor_name)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${p.creditor_iban}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${escapeXml(p.reference)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join('\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${selectedPayments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${escapeXml(config.company_name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${Date.now()}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${selectedPayments.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${selectedPayments[0]?.sequence_type || 'OOFF'}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${selectedPayments[0]?.execution_date || new Date().toISOString().split('T')[0]}</ReqdColltnDt>
      <Cdtr><Nm>${escapeXml(config.company_name)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${config.iban}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>${config.bic}</BIC></FinInstnId></CdtrAgt>
      <CdtrSchmeId><Id><PrvtId><Othr>
        <Id>${config.creditor_id}</Id>
        <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
      </Othr></PrvtId></Id></CdtrSchmeId>
${selectedPayments.map(p => `      <DrctDbtTxInf>
        <PmtId><EndToEndId>${p.end_to_end_id}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${p.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx><MndtRltdInf>
          <MndtId>${p.mandate_id || 'NOTPROVIDED'}</MndtId>
          <DtOfSgntr>${p.mandate_date || new Date().toISOString().split('T')[0]}</DtOfSgntr>
        </MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId>${p.creditor_bic ? `<BIC>${p.creditor_bic}</BIC>` : '<Othr><Id>NOTPROVIDED</Id></Othr>'}</FinInstnId></DbtrAgt>
        <Dbtr><Nm>${escapeXml(p.creditor_name)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${p.creditor_iban}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${escapeXml(p.reference)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`).join('\n')}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
    }
  }, [payments]);

  const createBatchAndExport = useCallback(async (
    type: SepaPaymentType,
    paymentIds: string[],
    config: SepaConfig
  ) => {
    if (!currentCompany) return null;
    const selectedPayments = payments.filter(p => paymentIds.includes(p.id));
    const totalAmount = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
    const xml = generateSepaXml(type, paymentIds, config);
    const messageId = `MSG-${Date.now()}`;

    const { data: batchData, error: batchError } = await supabase
      .from('sepa_batches').insert({
        company_id: currentCompany.id,
        type,
        status: 'exported',
        message_id: messageId,
        payment_count: selectedPayments.length,
        total_amount: totalAmount,
        execution_date: selectedPayments[0]?.execution_date || new Date().toISOString().split('T')[0],
        xml_content: xml,
      }).select().single();

    if (batchError) { toast.error('Fehler beim Erstellen des Batches'); return null; }

    // Update payments to exported
    await supabase.from('sepa_payments')
      .update({ status: 'exported', batch_id: batchData.id })
      .in('id', paymentIds);

    await loadData();
    return { batch: batchData as SepaBatch, xml };
  }, [currentCompany, payments, generateSepaXml, loadData]);

  const validateIban = useCallback((iban: string): boolean => {
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleanIban)) return false;
    const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
    let numericString = '';
    for (const char of rearranged) {
      numericString += /[A-Z]/.test(char) ? (char.charCodeAt(0) - 55).toString() : char;
    }
    let remainder = 0;
    for (const digit of numericString) {
      remainder = (remainder * 10 + parseInt(digit)) % 97;
    }
    return remainder === 1;
  }, []);

  const getPendingPayments = useCallback((type?: SepaPaymentType) => {
    return payments.filter(p =>
      (p.status === 'draft' || p.status === 'pending') && (!type || p.type === type)
    );
  }, [payments]);

  const getStats = useCallback(() => {
    const transfers = payments.filter(p => p.type === 'transfer');
    const directDebits = payments.filter(p => p.type === 'direct_debit');
    return {
      totalTransfers: transfers.length,
      pendingTransferAmount: transfers.filter(p => p.status === 'draft' || p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      totalDirectDebits: directDebits.length,
      pendingDirectDebitAmount: directDebits.filter(p => p.status === 'draft' || p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      exportedBatches: batches.length,
    };
  }, [payments, batches]);

  return {
    payments, batches, loading,
    createPayment, updatePaymentStatus, deletePayment,
    generateSepaXml, createBatchAndExport,
    validateIban, getPendingPayments, getStats,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
