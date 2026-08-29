// Renders an RFQ (Angebotsanfrage) email from a supplier + the materials to ask about.
// Pure and deterministic (a template, not an LLM), so it is unit-tested. German, since the
// suppliers are German trade wholesalers.

export interface RfqMaterial {
  description: string;
  qty: number | null;
  unit: string;
}

export interface RfqInput {
  supplierName: string;
  projectName: string;
  materials: RfqMaterial[];
}

export function renderRfq(input: RfqInput): { subject: string; body: string } {
  const subject = `Angebotsanfrage: ${input.projectName}`;
  const lines = input.materials.map((m) => {
    const qty = m.qty === null ? "" : ` (${m.qty} ${m.unit})`;
    return `- ${m.description}${qty}`;
  });
  const body = [
    `Sehr geehrte Damen und Herren von ${input.supplierName},`,
    "",
    `für das Projekt "${input.projectName}" bitten wir um ein Angebot für die folgenden Positionen:`,
    "",
    ...lines,
    "",
    "Bitte senden Sie uns Ihre Einzelpreise, Mindestabnahmemengen und Lieferzeiten.",
    "",
    "Mit freundlichen Grüßen",
  ].join("\n");
  return { subject, body };
}
