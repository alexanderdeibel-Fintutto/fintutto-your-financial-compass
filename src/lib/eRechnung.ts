import { InvoiceData } from '../components/invoices/InvoicePreview';

/**
 * Generates a ZUGFeRD 2.1.1 / XRechnung 3.0 compliant XML (EN 16931)
 * Profile: EN 16931 (COMFORT)
 */
export function generateZUGFeRDXML(invoice: InvoiceData): string {
  const issueDate = invoice.date.split('.').reverse().join(''); // DD.MM.YYYY -> YYYYMMDD
  const dueDate = invoice.dueDate.split('.').reverse().join('');
  
  const netTotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  
  const vatByRate = invoice.items.reduce((acc, item) => {
    const vatAmount = item.quantity * item.price * item.vatRate / 100;
    const netAmount = item.quantity * item.price;
    if (!acc[item.vatRate]) {
      acc[item.vatRate] = { net: 0, vat: 0 };
    }
    acc[item.vatRate].net += netAmount;
    acc[item.vatRate].vat += vatAmount;
    return acc;
  }, {} as Record<number, { net: number; vat: number }>);

  let vatTotal = 0;
  Object.values(vatByRate).forEach(v => vatTotal += v.vat);
  const grossTotal = netTotal + vatTotal;

  // Helper to format numbers to 2 decimal places
  const f2 = (num: number) => num.toFixed(2);

  // Split customer address
  const customerAddressParts = invoice.customer.address.split('\n');
  const customerStreet = customerAddressParts[0] || '';
  const customerCityZip = customerAddressParts.length > 1 ? customerAddressParts[customerAddressParts.length - 1] : '';
  const customerZipMatch = customerCityZip.match(/^(\d{5})\s+(.*)$/);
  const customerZip = customerZipMatch ? customerZipMatch[1] : '';
  const customerCity = customerZipMatch ? customerZipMatch[2] : customerCityZip;

  // Split company address
  const companyAddressParts = invoice.company.address.split('\n');
  const companyStreet = companyAddressParts[0] || '';
  const companyCityZip = companyAddressParts.length > 1 ? companyAddressParts[companyAddressParts.length - 1] : '';
  const companyZipMatch = companyCityZip.match(/^(\d{5})\s+(.*)$/);
  const companyZip = companyZipMatch ? companyZipMatch[1] : '';
  const companyCity = companyZipMatch ? companyZipMatch[2] : companyCityZip;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:xs="http://www.w3.org/2001/XMLSchema"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoice.number}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${invoice.notes}</ram:Content></ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
`;

  invoice.items.forEach((item, index) => {
    const netPrice = item.price;
    const netAmount = item.quantity * item.price;
    
    // Unit codes: C62 (piece), HUR (hour), KGM (kg), MTR (meter), MON (month)
    let unitCode = 'C62';
    if (item.unit.toLowerCase().includes('stunde') || item.unit.toLowerCase() === 'std') unitCode = 'HUR';
    else if (item.unit.toLowerCase().includes('monat')) unitCode = 'MON';
    else if (item.unit.toLowerCase().includes('tag')) unitCode = 'DAY';
    else if (item.unit.toLowerCase().includes('pauschale')) unitCode = 'LS';

    xml += `      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${item.description}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${f2(netPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${item.vatRate === 0 ? 'E' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${f2(item.vatRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${f2(netAmount)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
`;
  });

  xml += `    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${invoice.company.name}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${companyZip}</ram:PostcodeCode>
          <ram:LineOne>${companyStreet}</ram:LineOne>
          <ram:CityName>${companyCity}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        ${invoice.company.vatId ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${invoice.company.vatId}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${invoice.customer.name}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${customerZip}</ram:PostcodeCode>
          <ram:LineOne>${customerStreet}</ram:LineOne>
          <ram:CityName>${customerCity}</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        ${invoice.customer.vatId ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${invoice.customer.vatId}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${invoice.number}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${invoice.company.iban || ''}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
`;

  Object.entries(vatByRate).forEach(([rateStr, amounts]) => {
    const rate = parseFloat(rateStr);
    xml += `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${f2(amounts.vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${f2(amounts.net)}</ram:BasisAmount>
        <ram:CategoryCode>${rate === 0 ? 'E' : 'S'}</ram:CategoryCode>
        <ram:RateApplicablePercent>${f2(rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
`;
  });

  xml += `      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${f2(netTotal)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${f2(netTotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${f2(vatTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${f2(grossTotal)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${f2(grossTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}
