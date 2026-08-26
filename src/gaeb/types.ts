/**
 * Types for a parsed GAEB X83 (Angebotsaufforderung - the unpriced tender we ingest).
 * Deliberately a small, flat shape: the rest of the system only needs the positions.
 */

export type PositionKind =
  | "normal" // standard, priced, counts in the sum
  | "qtyTBD"; // quantity to be determined (QtyTBD="Yes") - priced but qty unknown up front

export interface Position {
  /** Ordnungszahl - the hierarchical row number, e.g. "01.02.002" (built from the RNoPart chain). */
  oz: string;
  /** Short text (Kurztext) - the one-line label. Mandatory in valid GAEB. */
  shortText: string;
  /** Long text (Langtext) - the legally binding description. */
  longText: string;
  /** Quantity (Menge). null when QtyTBD. */
  qty: number | null;
  /** Unit (Einheit / QU), e.g. "m³", "m²", "Stück". */
  unit: string;
  kind: PositionKind;
  /** The GAEB Item ID attribute (stable id from the source file). */
  sourceId: string;
}

export interface ParsedX83 {
  /** Data-exchange phase from <DP>. Should be "83" for an X83. */
  phase: string;
  /** GAEB DA XML version, e.g. "3.2". */
  gaebVersion: string;
  /** Currency from <Cur>, e.g. "€". */
  currency: string;
  /** Project name from <NamePrj>. */
  projectName: string;
  positions: Position[];
}
