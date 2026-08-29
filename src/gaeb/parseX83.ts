import { XMLParser } from "fast-xml-parser";
import type { ParsedX83, Position, PositionKind } from "./types.js";

/**
 * Parse a GAEB DA XML X83 (Angebotsaufforderung) into a flat list of positions.
 *
 * Handles: nested BoQCtgy, multiple <Award>/<BoQ> blocks, QtyTBD, comma-decimal quantities,
 * and arrays where the schema allows repeats. Fails loudly on non-GAEB input or a non-83 phase
 * rather than silently returning nothing.
 *
 * Still assumes UTF-8 (DA2000 CP1252 files would need encoding detection at the ingest layer).
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false, // keep tag text as strings; we parse numbers explicitly (see parseGaebNumber)
});

type XmlNode = Record<string, unknown>;
type Maybe = XmlNode | XmlNode[] | undefined;

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
      if (key.startsWith("@_")) continue;
      parts.push(collectText(val));
    }
    return parts.join(" ");
  }
  return "";
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Parse a GAEB quantity. DA XML uses '.' as the decimal separator, but some tools emit German
 * formatting ("1.234,56"). Heuristic: if a comma is present, treat it as the decimal separator
 * and '.' as thousands.
 */
export function parseGaebNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function firstComplete(description: XmlNode | undefined): XmlNode {
  return (toArray<XmlNode>(description?.CompleteText as Maybe)[0] ?? {}) as XmlNode;
}

function shortTextOf(description: XmlNode | undefined): string {
  const complete = firstComplete(description);
  const outline = (toArray<XmlNode>(complete.OutlineText as Maybe)[0] ?? {}) as XmlNode;
  const outlTxt = (toArray<XmlNode>(outline.OutlTxt as Maybe)[0] ?? {}) as XmlNode;
  return normaliseWhitespace(collectText(outlTxt.TextOutlTxt));
}

function longTextOf(description: XmlNode | undefined): string {
  return normaliseWhitespace(collectText(firstComplete(description).DetailTxt));
}

function itemToPosition(item: XmlNode, ozPrefix: string): Position {
  const rNo = String(item["@_RNoPart"] ?? "").trim();
  const oz = ozPrefix && rNo ? `${ozPrefix}.${rNo}` : ozPrefix || rNo;
  const qtyTBD = String(item.QtyTBD ?? "").toLowerCase() === "yes";
  const kind: PositionKind = qtyTBD ? "qtyTBD" : "normal";
  const description = item.Description as XmlNode | undefined;
  return {
    oz,
    shortText: shortTextOf(description),
    longText: longTextOf(description),
    qty: qtyTBD ? null : parseGaebNumber(item.Qty),
    unit: normaliseWhitespace(collectText(item.QU)),
    kind,
    sourceId: String(item["@_ID"] ?? ""),
  };
}

function walkBoQBody(body: XmlNode | undefined, ozPrefix: string, out: Position[]): void {
  if (!body) return;

  for (const ctgy of toArray<XmlNode>(body.BoQCtgy as Maybe)) {
    const rNo = String(ctgy["@_RNoPart"] ?? "").trim();
    const nextPrefix = ozPrefix && rNo ? `${ozPrefix}.${rNo}` : ozPrefix || rNo;
    walkBoQBody(ctgy.BoQBody as XmlNode | undefined, nextPrefix, out);
  }

  for (const list of toArray<XmlNode>(body.Itemlist as Maybe)) {
    for (const item of toArray<XmlNode>(list.Item as Maybe)) {
      out.push(itemToPosition(item, ozPrefix));
    }
  }
}

export function parseX83(xml: string): ParsedX83 {
  const clean = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const root = parser.parse(clean) as XmlNode;

  const gaeb = root.GAEB as XmlNode | undefined;
  if (!gaeb) throw new Error("not a GAEB file (missing <GAEB> root)");

  const info = (gaeb.GAEBInfo ?? {}) as XmlNode;
  const prj = (gaeb.PrjInfo ?? {}) as XmlNode;

  const awards = toArray<XmlNode>(gaeb.Award as Maybe);
  const firstAward = awards[0];
  if (!firstAward) throw new Error("GAEB file has no <Award> block");

  const phase = String(firstAward.DP ?? "");
  if (phase && phase !== "83") {
    throw new Error(`expected an X83 (Angebotsaufforderung) but got exchange phase DP=${phase}`);
  }

  const positions: Position[] = [];
  for (const award of awards) {
    for (const boq of toArray<XmlNode>(award.BoQ as Maybe)) {
      walkBoQBody(boq.BoQBody as XmlNode | undefined, "", positions);
    }
  }

  const awardInfo = (firstAward.AwardInfo ?? {}) as XmlNode;
  return {
    phase: phase || "83",
    gaebVersion: String(info.Version ?? ""),
    currency: normaliseWhitespace(collectText(prj.Cur ?? awardInfo.Cur)),
    projectName: normaliseWhitespace(collectText(prj.NamePrj)),
    positions,
  };
}
