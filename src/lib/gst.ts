export interface InvoiceLine {
  quantity: number;
  rate: number;
  gst_rate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount_amount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  items: Array<{
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total: number;
  }>;
}

export function computeTotals(
  lines: InvoiceLine[],
  opts: { isInterstate: boolean; discountType: "amount" | "percent"; discountValue: number },
): InvoiceTotals {
  const round = (n: number) => Math.round(n * 100) / 100;

  const lineSubtotals = lines.map((l) => round((Number(l.quantity) || 0) * (Number(l.rate) || 0)));
  const subtotal = round(lineSubtotals.reduce((a, b) => a + b, 0));

  const discount_amount =
    opts.discountType === "percent"
      ? round((subtotal * (Number(opts.discountValue) || 0)) / 100)
      : round(Number(opts.discountValue) || 0);

  const discountRatio = subtotal > 0 ? discount_amount / subtotal : 0;

  const items = lines.map((l, i) => {
    const lineGross = lineSubtotals[i];
    const taxable = round(lineGross * (1 - discountRatio));
    const taxRate = Number(l.gst_rate) || 0;
    const totalTax = round((taxable * taxRate) / 100);
    const cgst = opts.isInterstate ? 0 : round(totalTax / 2);
    const sgst = opts.isInterstate ? 0 : round(totalTax - cgst);
    const igst = opts.isInterstate ? totalTax : 0;
    return {
      taxable_amount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total: round(taxable + cgst + sgst + igst),
    };
  });

  const taxable = round(items.reduce((a, b) => a + b.taxable_amount, 0));
  const cgst = round(items.reduce((a, b) => a + b.cgst_amount, 0));
  const sgst = round(items.reduce((a, b) => a + b.sgst_amount, 0));
  const igst = round(items.reduce((a, b) => a + b.igst_amount, 0));
  const total = round(taxable + cgst + sgst + igst);

  return { subtotal, discount_amount, taxable, cgst, sgst, igst, total, items };
}

/** Convert integer rupees to Indian English words. */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = numberToIndianWords(rupees) + " Rupees";
  if (paise > 0) result += " and " + numberToIndianWords(paise) + " Paise";
  return result + " Only";
}

/** HSN-wise tax summary row used in the GST tax summary table. */
export interface HsnSummaryRow {
  hsn: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
}

/** Group invoice items by HSN/SAC code and sum taxable + tax components. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hsnSummary(items: any[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const it of items) {
    const hsn = (it.hsn_sac || "—").toString();
    const row = map.get(hsn) ?? { hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 };
    row.taxable += Number(it.taxable_amount ?? 0);
    row.cgst += Number(it.cgst_amount ?? 0);
    row.sgst += Number(it.sgst_amount ?? 0);
    row.igst += Number(it.igst_amount ?? 0);
    row.total_tax = row.cgst + row.sgst + row.igst;
    map.set(hsn, row);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return Array.from(map.values()).map((r) => ({
    ...r,
    taxable: round(r.taxable),
    cgst: round(r.cgst),
    sgst: round(r.sgst),
    igst: round(r.igst),
    total_tax: round(r.total_tax),
  }));
}

function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (n: number): string =>
    n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return (h ? ones[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
  };
  let n = Math.floor(num);
  let out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += twoDigits(crore) + " Crore ";
  if (lakh) out += twoDigits(lakh) + " Lakh ";
  if (thousand) out += twoDigits(thousand) + " Thousand ";
  if (n) out += threeDigits(n);
  return out.trim();
}