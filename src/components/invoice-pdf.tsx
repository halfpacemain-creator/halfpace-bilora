import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { formatINR, formatDate, formatNumber } from "@/lib/format";
import { amountInWords, hsnSummary } from "@/lib/gst";
import { themeFor, type InvoiceThemeKey } from "@/lib/invoice-themes";
import { BRAND } from "@/lib/brand";

// Use system fonts — avoid network font loads in the PDF renderer.
Font.registerHyphenationCallback((word) => [word]);

function makeStyles(theme: ReturnType<typeof themeFor>) {
  const isMinimal = theme.headerStyle === "minimal";
  const radius = isMinimal ? 0 : 3;
  return StyleSheet.create({
    page: { paddingTop: 28, paddingBottom: 56, paddingHorizontal: 32, fontSize: 9, color: theme.ink, fontFamily: theme.fontBody, lineHeight: 1.35 },
    topBar: isMinimal
      ? { height: 0, marginBottom: 4 }
      : { height: 6, backgroundColor: theme.accent, marginBottom: 14, borderRadius: 1 },

    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    logo: { width: 56, height: 56, objectFit: "contain" },
    companyName: { fontSize: 15, fontWeight: 700, color: theme.ink, fontFamily: theme.fontHeading, marginBottom: 2 },
    companyBlock: { marginLeft: 10, flex: 1 },
    meta: { color: theme.muted, lineHeight: 1.45, fontSize: 8.5 },
    metaInk: { color: theme.ink, fontSize: 9, lineHeight: 1.45 },
    invoiceTitle: { fontSize: 20, fontWeight: 700, color: theme.accent, textTransform: "uppercase", letterSpacing: 2, fontFamily: theme.fontHeading },
    statusPill: {
      marginTop: 6, alignSelf: "flex-end",
      paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: theme.accent, color: theme.accentForeground,
      fontSize: 7.5, textTransform: "uppercase", letterSpacing: 1, borderRadius: 999,
    },
    invoiceMetaGrid: {
      marginTop: 8, padding: 8,
      borderRadius: radius,
      backgroundColor: isMinimal ? "transparent" : theme.surface,
      border: isMinimal ? `0.5pt solid ${theme.border}` : "none",
      minWidth: 200,
    },
    metaLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    metaLabel: { color: theme.muted, fontSize: 8 },
    metaValue: { color: theme.ink, fontSize: 9, fontWeight: 700 },

    partiesRow: { flexDirection: "row", marginTop: 18, gap: 12 },
    party: { flex: 1, padding: 10, borderRadius: radius, border: `0.5pt solid ${theme.border}`, backgroundColor: isMinimal ? "transparent" : theme.surface },
    partyLabel: { fontSize: 7.5, color: theme.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    partyName: { fontSize: 10.5, fontWeight: 700, marginBottom: 2, color: theme.ink },

    table: { marginTop: 16, borderRadius: radius, overflow: "hidden", border: `0.5pt solid ${theme.border}` },
    th: {
      flexDirection: "row",
      backgroundColor: isMinimal ? theme.surface : theme.accent,
      color: isMinimal ? theme.ink : theme.accentForeground,
      paddingVertical: 7, paddingHorizontal: 6,
      fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
      fontFamily: theme.fontHeading,
    },
    tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderTop: `0.5pt solid ${theme.border}`, alignItems: "flex-start" },
    cSr: { width: 18 },
    cItem: { flex: 1, paddingRight: 4 },
    cHsn: { width: 50, fontSize: 8.5 },
    cQty: { width: 36, textAlign: "right" },
    cUnit: { width: 28, textAlign: "left", paddingLeft: 4, color: theme.muted, fontSize: 8 },
    cRate: { width: 56, textAlign: "right" },
    cGst: { width: 32, textAlign: "right" },
    cAmt: { width: 64, textAlign: "right", fontWeight: 700 },

    sectionTitle: { fontSize: 8, color: theme.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    summary: { marginTop: 14, borderRadius: radius, border: `0.5pt solid ${theme.border}`, overflow: "hidden" },
    sumHead: { flexDirection: "row", backgroundColor: theme.surface, paddingVertical: 5, paddingHorizontal: 6, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: theme.ink },
    sumRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderTop: `0.5pt solid ${theme.border}` },
    sumTot: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTop: `0.5pt solid ${theme.border}`, fontWeight: 700, backgroundColor: theme.surface },
    sumCol0: { flex: 1 },
    sumColN: { width: 70, textAlign: "right" },

    totalsRow: { flexDirection: "row", marginTop: 14, gap: 14 },
    totalsLeft: { flex: 1 },
    totalsRight: {
      width: 220, padding: 10, borderRadius: radius,
      backgroundColor: isMinimal ? "transparent" : theme.surface,
      border: `0.5pt solid ${theme.border}`,
    },
    totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3, fontSize: 9 },
    grand: {
      flexDirection: "row", justifyContent: "space-between", marginTop: 6,
      paddingTop: 6, borderTop: `1pt solid ${theme.accent}`, fontSize: 12, fontWeight: 700, color: theme.accent,
    },

    inWords: { marginTop: 10, padding: 8, border: `0.5pt solid ${theme.border}`, borderRadius: radius, color: theme.ink, fontSize: 9 },

    footerRow: { flexDirection: "row", marginTop: 18, gap: 14 },
    bankBox: { flex: 1, padding: 10, borderRadius: radius, border: `0.5pt solid ${theme.border}` },
    qrBox: { width: 110, alignItems: "center" },
    qr: { width: 88, height: 88, marginTop: 4 },

    signaturesRow: { flexDirection: "row", marginTop: 22, gap: 14 },
    signBox: { flex: 1, alignItems: "center" },
    signImg: { width: 100, height: 44, objectFit: "contain" },
    stampImg: { width: 70, height: 70, objectFit: "contain", position: "absolute", right: 10, top: -10, opacity: 0.85 },
    signLine: { width: "70%", borderTop: `0.7pt solid ${theme.ink}`, marginTop: 8, paddingTop: 4, textAlign: "center", fontSize: 9, fontWeight: 700 },
    signSub: { textAlign: "center", color: theme.muted, fontSize: 7.5, marginTop: 2 },

    terms: { marginTop: 16, padding: 10, borderRadius: radius, border: `0.5pt solid ${theme.border}` },
    termsItem: { color: theme.ink, fontSize: 8.5, marginBottom: 2 },

    brandFooter: {
      position: "absolute", left: 32, right: 32, bottom: 18,
      flexDirection: "row", justifyContent: "space-between",
      color: theme.muted, fontSize: 7, letterSpacing: 1, textTransform: "uppercase",
      borderTop: `0.5pt solid ${theme.border}`, paddingTop: 6,
    },
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", partial: "Partially Paid", overdue: "Overdue", cancelled: "Cancelled",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InvoicePDF({ company, invoice, items, qrDataUrl, theme: themeKey }: { company: any; invoice: any; items: any[]; qrDataUrl?: string; theme?: InvoiceThemeKey | string | null }) {
  const isInter = invoice.is_interstate;
  const theme = themeFor(themeKey ?? invoice.invoice_theme ?? company.invoice_theme);
  const s = makeStyles(theme);
  const hsnRows = hsnSummary(items);
  const totalTax = Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0);
  const roundOff = Math.round((Number(invoice.total) - (Number(invoice.subtotal) - Number(invoice.discount_amount || 0) + totalTax)) * 100) / 100;

  const shipName = invoice.shipping_name || invoice.customer_name;
  const shipAddr = invoice.shipping_address || invoice.customer_billing_address;
  const sameAddress = !invoice.shipping_address || invoice.shipping_address === invoice.customer_billing_address;

  const termsLines: string[] = (invoice.terms || "").split(/\r?\n/).map((t: string) => t.trim()).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} />

        <View style={s.headerRow}>
          <View style={{ flexDirection: "row", flex: 1, paddingRight: 12 }}>
            {company.logo_url ? <Image style={s.logo} src={company.logo_url} /> : null}
            <View style={s.companyBlock}>
              <Text style={s.companyName}>{company.name}</Text>
              <Text style={s.meta}>
                {[company.address_line1, company.address_line2].filter(Boolean).join(", ")}
                {(company.address_line1 || company.address_line2) ? "\n" : ""}
                {[company.city, company.state, company.pincode].filter(Boolean).join(", ")}
              </Text>
              <Text style={[s.meta, { marginTop: 3 }]}>
                {company.gstin ? `GSTIN: ${company.gstin}` : ""}
                {company.pan ? `   PAN: ${company.pan}` : ""}
              </Text>
              <Text style={s.meta}>
                {company.phone ? `Tel: ${company.phone}` : ""}
                {company.email ? `   Email: ${company.email}` : ""}
              </Text>
              {company.website ? <Text style={s.meta}>Web: {company.website}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.invoiceTitle}>Tax Invoice</Text>
            <Text style={s.statusPill}>{STATUS_LABEL[invoice.status] || invoice.status}</Text>
            <View style={s.invoiceMetaGrid}>
              <View style={s.metaLine}><Text style={s.metaLabel}>Invoice #</Text><Text style={s.metaValue}>{invoice.invoice_number}</Text></View>
              <View style={s.metaLine}><Text style={s.metaLabel}>Date</Text><Text style={s.metaValue}>{formatDate(invoice.invoice_date)}</Text></View>
              {invoice.due_date && <View style={s.metaLine}><Text style={s.metaLabel}>Due date</Text><Text style={s.metaValue}>{formatDate(invoice.due_date)}</Text></View>}
              <View style={s.metaLine}><Text style={s.metaLabel}>Place of supply</Text><Text style={s.metaValue}>{invoice.customer_state || "—"}</Text></View>
            </View>
          </View>
        </View>

        <View style={s.partiesRow}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Bill to</Text>
            <Text style={s.partyName}>{invoice.customer_name}</Text>
            <Text style={s.metaInk}>
              {invoice.customer_billing_address}
              {invoice.customer_state ? `\n${invoice.customer_state}` : ""}
            </Text>
            <Text style={[s.meta, { marginTop: 3 }]}>
              {invoice.customer_gstin ? `GSTIN: ${invoice.customer_gstin}\n` : ""}
              {invoice.customer_phone ? `Tel: ${invoice.customer_phone}\n` : ""}
              {invoice.customer_email ? `Email: ${invoice.customer_email}` : ""}
            </Text>
          </View>
          <View style={s.party}>
            <Text style={s.partyLabel}>Ship to {sameAddress ? "(same as billing)" : ""}</Text>
            <Text style={s.partyName}>{shipName}</Text>
            <Text style={s.metaInk}>{shipAddr}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={s.cSr}>#</Text>
            <Text style={s.cItem}>Item & Description</Text>
            <Text style={s.cHsn}>HSN/SAC</Text>
            <Text style={s.cQty}>Qty</Text>
            <Text style={s.cUnit}>Unit</Text>
            <Text style={s.cRate}>Rate</Text>
            <Text style={s.cGst}>GST %</Text>
            <Text style={s.cAmt}>Amount</Text>
          </View>
          {items.map((it, i) => (
            <View key={it.id} style={[s.tr, i % 2 ? { backgroundColor: theme.surface } : {}]} wrap={false}>
              <Text style={s.cSr}>{i + 1}</Text>
              <View style={s.cItem}>
                <Text style={{ fontWeight: 700, fontSize: 9.5 }}>{it.name}</Text>
                {it.description ? <Text style={{ color: theme.muted, fontSize: 8 }}>{it.description}</Text> : null}
              </View>
              <Text style={s.cHsn}>{it.hsn_sac || "—"}</Text>
              <Text style={s.cQty}>{formatNumber(it.quantity)}</Text>
              <Text style={s.cUnit}>{it.unit || ""}</Text>
              <Text style={s.cRate}>{formatINR(it.rate)}</Text>
              <Text style={s.cGst}>{it.gst_rate}%</Text>
              <Text style={s.cAmt}>{formatINR(it.total)}</Text>
            </View>
          ))}
        </View>

        {hsnRows.length > 0 && (
          <View style={s.summary} wrap={false}>
            <View style={s.sumHead}>
              <Text style={s.sumCol0}>HSN / SAC</Text>
              <Text style={s.sumColN}>Taxable</Text>
              {isInter
                ? <Text style={s.sumColN}>IGST</Text>
                : (<><Text style={s.sumColN}>CGST</Text><Text style={s.sumColN}>SGST</Text></>)}
              <Text style={s.sumColN}>Total Tax</Text>
            </View>
            {hsnRows.map((r) => (
              <View key={r.hsn} style={s.sumRow}>
                <Text style={s.sumCol0}>{r.hsn}</Text>
                <Text style={s.sumColN}>{formatINR(r.taxable)}</Text>
                {isInter
                  ? <Text style={s.sumColN}>{formatINR(r.igst)}</Text>
                  : (<><Text style={s.sumColN}>{formatINR(r.cgst)}</Text><Text style={s.sumColN}>{formatINR(r.sgst)}</Text></>)}
                <Text style={s.sumColN}>{formatINR(r.total_tax)}</Text>
              </View>
            ))}
            <View style={s.sumTot}>
              <Text style={s.sumCol0}>Total</Text>
              <Text style={s.sumColN}>{formatINR(hsnRows.reduce((a, b) => a + b.taxable, 0))}</Text>
              {isInter
                ? <Text style={s.sumColN}>{formatINR(invoice.igst_amount)}</Text>
                : (<><Text style={s.sumColN}>{formatINR(invoice.cgst_amount)}</Text><Text style={s.sumColN}>{formatINR(invoice.sgst_amount)}</Text></>)}
              <Text style={s.sumColN}>{formatINR(totalTax)}</Text>
            </View>
          </View>
        )}

        <View style={s.totalsRow} wrap={false}>
          <View style={s.totalsLeft}>
            <View style={s.inWords}>
              <Text style={{ color: theme.muted, fontSize: 7.5, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Amount in words</Text>
              <Text style={{ fontWeight: 700 }}>{amountInWords(invoice.total)}</Text>
            </View>
          </View>
          <View style={s.totalsRight}>
            <View style={s.totalLine}><Text>Subtotal</Text><Text>{formatINR(invoice.subtotal)}</Text></View>
            {Number(invoice.discount_amount) > 0 && (
              <View style={s.totalLine}><Text>Discount</Text><Text>- {formatINR(invoice.discount_amount)}</Text></View>
            )}
            {isInter ? (
              <View style={s.totalLine}><Text>IGST</Text><Text>{formatINR(invoice.igst_amount)}</Text></View>
            ) : (
              <>
                <View style={s.totalLine}><Text>CGST</Text><Text>{formatINR(invoice.cgst_amount)}</Text></View>
                <View style={s.totalLine}><Text>SGST</Text><Text>{formatINR(invoice.sgst_amount)}</Text></View>
              </>
            )}
            {roundOff !== 0 && (
              <View style={s.totalLine}><Text>Round off</Text><Text>{roundOff > 0 ? "+ " : "- "}{formatINR(Math.abs(roundOff))}</Text></View>
            )}
            <View style={s.grand}>
              <Text>Grand Total</Text>
              <Text>{formatINR(invoice.total)}</Text>
            </View>
            {Number(invoice.amount_paid) > 0 && (
              <>
                <View style={[s.totalLine, { marginTop: 4 }]}><Text>Paid</Text><Text>- {formatINR(invoice.amount_paid)}</Text></View>
                <View style={[s.totalLine, { color: theme.ink }]}><Text>Balance due</Text><Text>{formatINR(Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)))}</Text></View>
              </>
            )}
          </View>
        </View>

        {(company.bank_name || company.bank_account_number || (company.upi_id && qrDataUrl)) && (
          <View style={s.footerRow} wrap={false}>
            {(company.bank_name || company.bank_account_number) && (
              <View style={s.bankBox}>
                <Text style={s.sectionTitle}>Bank details</Text>
                <Text style={s.metaInk}>
                  {company.bank_name ? `Bank: ${company.bank_name}\n` : ""}
                  {company.bank_account_name ? `A/C name: ${company.bank_account_name}\n` : ""}
                  {company.bank_account_number ? `A/C no: ${company.bank_account_number}\n` : ""}
                  {company.bank_ifsc ? `IFSC: ${company.bank_ifsc}` : ""}
                </Text>
              </View>
            )}
            {company.upi_id && qrDataUrl && (
              <View style={s.qrBox}>
                <Text style={s.sectionTitle}>Scan & Pay</Text>
                <Image style={s.qr} src={qrDataUrl} />
                <Text style={[s.meta, { marginTop: 3, textAlign: "center" }]}>{company.upi_id}</Text>
              </View>
            )}
          </View>
        )}

        {(termsLines.length > 0 || invoice.notes) && (
          <View style={s.terms} wrap={false}>
            {invoice.notes && (
              <>
                <Text style={s.sectionTitle}>Notes</Text>
                <Text style={[s.termsItem, { marginBottom: 6 }]}>{invoice.notes}</Text>
              </>
            )}
            {termsLines.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Terms & conditions</Text>
                {termsLines.map((t, i) => (
                  <Text key={i} style={s.termsItem}>{i + 1}. {t}</Text>
                ))}
              </>
            )}
          </View>
        )}

        <View style={s.signaturesRow} wrap={false}>
          <View style={s.signBox}>
            <View style={{ height: 44 }} />
            <Text style={s.signLine}>Receiver Signature</Text>
            <Text style={s.signSub}>Goods received in good condition</Text>
          </View>
          <View style={[s.signBox, { position: "relative" }]}>
            {company.stamp_url ? <Image style={s.stampImg} src={company.stamp_url} /> : null}
            {company.signature_url ? <Image style={s.signImg} src={company.signature_url} /> : <View style={{ height: 44 }} />}
            <Text style={s.signLine}>Authorised Signatory</Text>
            <Text style={s.signSub}>For {company.name}</Text>
          </View>
        </View>

        <View style={s.brandFooter} fixed>
          <Text>This is a computer-generated invoice.</Text>
          <Text>Generated by {BRAND.name} · halfpace.in</Text>
        </View>
      </Page>
    </Document>
  );
}