/** First and last day ("YYYY-MM-DD") of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}
