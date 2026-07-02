export const formatINR = (n: number | string | null | undefined) => {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatNumber = (n: number | string | null | undefined, dp = 2) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(Number(n ?? 0));

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const isoDate = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export const addDays = (date: Date | string, days: number) => {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};