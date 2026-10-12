/**
 * Builds a small but valid text-layer PDF invoice (tests, e2e, demo seeding).
 * Uses the standard Helvetica font and WinAnsi encoding — no dependencies.
 */
export function buildInvoicePdf(opts: {
  vendor?: string;
  number?: string;
  date?: string;
  totalHt?: number;
  vat?: number;
  totalTtc?: number;
  iban?: string;
  extraLines?: string[];
} = {}): Buffer {
  const ht = opts.totalHt ?? 1250;
  const vat = opts.vat ?? Math.round(ht * 0.2 * 100) / 100;
  const ttc = opts.totalTtc ?? Math.round((ht + vat) * 100) / 100;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const lines = [
    opts.vendor ?? "Papeterie Martin SARL",
    "12 rue des Lilas, 69003 Lyon - SIRET 123 456 789 00012",
    "",
    `FACTURE N° ${opts.number ?? "FA-2026-0142"}`,
    `Date de facture : ${opts.date ?? "02/10/2026"}`,
    "Échéance : 01/11/2026",
    "",
    "Désignation                         Quantité     Montant",
    "Fournitures de bureau                     1      " + fmt(ht),
    "",
    `Total HT : ${fmt(ht)} €`,
    `TVA 20 % : ${fmt(vat)} €`,
    `Total TTC : ${fmt(ttc)} €`,
    "",
    `IBAN : ${opts.iban ?? "FR76 3000 6000 0112 3456 7890 189"}`,
    ...(opts.extraLines ?? []),
  ];
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "60 780 Td",
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const streamBuf = Buffer.from(stream, "latin1");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${streamBuf.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
