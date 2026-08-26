import { XMLParser } from "fast-xml-parser";
import type { ParsedX83, Position, PositionKind } from "./types.js";

/**
 * Parse a GAEB DA XML X83 (Angebotsaufforderung) into a flat list of positions.
 *
 * Scope (M0): DA XML 3.x, UTF-8. Walks BoQ → nested BoQCtgy → Itemlist → Item,
 * building the Ordnungszahl (OZ) from the RNoPart chain. Skips <Remark> blocks.
 *
 * Known gaps (tracked in the plan / RFC), not yet handled:
 *  - CP1252-encoded DA2000 files (assume UTF-8 for now)
 *  - multiple <Award> blocks in one file
 *  - position types beyond normal / QtyTBD (Bedarf, Wahl, Zuschlag)
 *  - unit normalisation (m vs lfm, m² vs qm)
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // keep leading zeros on RNoPart etc. (attributes stay strings by default)
  parseAttributeValue: false,
});

/** Coerce a fast-xml-parser child (object | array | undefined) into an array. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Recursively collect all text under a node, skipping attributes. Handles <p>/<span> nesting. */
function collectText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object") {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (key.startsWith("@_")) continue; // skip attributes
      parts.push(collectText(val));
    }
    return parts.join(" ");
  }
  return "";
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Parse a GAEB quantity string/number to a number. DA XML uses '.' as the decimal separator. */
function parseQty(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw));
  return Number.isFinite(n) ? n : null;
}

type XmlNode = Record<string, unknown>;

/** Extract the short text (Kurztext) from an Item's Description. */
function shortTextOf(description: XmlNode | undefined): string {
  const complete = (description?.CompleteText ?? {}) as XmlNode;
  const outline = (complete.OutlineText ?? {}) as XmlNode;
  const outlTxt = (outline.OutlTxt ?? {}) as XmlNode;
  return normaliseWhitespace(collectText(outlTxt.TextOutlTxt));
}

/** Extract the long text (Langtext) from an Item's Description. */
function longTextOf(description: XmlNode | undefined): string {
  const complete = (description?.CompleteText ?? {}) as XmlNode;
  return normaliseWhitespace(collectText(complete.DetailTxt));
}

function itemToPosition(item: XmlNode, ozPrefix: string): Position {
  const rNo = String(item["@_RNoPart"] ?? "");
  const oz = ozPrefix ? `${ozPrefix}.${rNo}` : rNo;
  const qtyTBD = String(item.QtyTBD ?? "").toLowerCase() === "yes";
  const kind: PositionKind = qtyTBD ? "qtyTBD" : "normal";
  const description = item.Description as XmlNode | undefined;
  return {
    oz,
    shortText: shortTextOf(description),
    longText: longTextOf(description),
    qty: qtyTBD ? null : parseQty(item.Qty),
    unit: normaliseWhitespace(collectText(item.QU)),
    kind,
    sourceId: String(item["@_ID"] ?? ""),
  };
}

/** Recursively walk a BoQBody, descending nested BoQCtgy and collecting Items. */
function walkBoQBody(body: XmlNode | undefined, ozPrefix: string, out: Position[]): void {
  if (!body) return;

  // Nested categories (Titel). Each contributes its RNoPart to the OZ.
  for (const ctgy of toArray<XmlNode>(body.BoQCtgy as XmlNode | XmlNode[] | undefined)) {
    const rNo = String(ctgy["@_RNoPart"] ?? "");
    const nextPrefix = ozPrefix ? `${ozPrefix}.${rNo}` : rNo;
    walkBoQBody(ctgy.BoQBody as XmlNode | undefined, nextPrefix, out);
  }

  // Items live inside Itemlist. (Remark blocks are ignored - they aren't positions.)
  for (const list of toArray<XmlNode>(body.Itemlist as XmlNode | XmlNode[] | undefined)) {
    for (const item of toArray<XmlNode>(list.Item as XmlNode | XmlNode[] | undefined)) {
      out.push(itemToPosition(item, ozPrefix));
    }
  }
}

export function parseX83(xml: string): ParsedX83 {
  // Strip a UTF-8 BOM if present.
  const clean = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const root = parser.parse(clean) as XmlNode;

  const gaeb = (root.GAEB ?? {}) as XmlNode;
  const info = (gaeb.GAEBInfo ?? {}) as XmlNode;
  const prj = (gaeb.PrjInfo ?? {}) as XmlNode;
  const award = (gaeb.Award ?? {}) as XmlNode;
  const boq = (award.BoQ ?? {}) as XmlNode;

  const positions: Position[] = [];
  walkBoQBody(boq.BoQBody as XmlNode | undefined, "", positions);

  return {
    phase: String(award.DP ?? ""),
    gaebVersion: String(info.Version ?? ""),
    currency: normaliseWhitespace(collectText(prj.Cur ?? (award.AwardInfo as XmlNode)?.Cur)),
    projectName: normaliseWhitespace(collectText(prj.NamePrj)),
    positions,
  };
}
