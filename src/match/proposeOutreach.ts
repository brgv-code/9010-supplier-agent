// Rule-based supplier matching (deterministic, no LLM). Pairs each material with the
// suppliers whose categories overlap, ranked by reliability. Kept pure so it is unit-tested.
// A real system would match on a proper taxonomy (STLB-Bau); this token overlap is the MVP.

export interface MatchMaterial {
  id: string;
  category: string;
}

export interface MatchSupplier {
  id: string;
  categories: string[];
  reliability: number;
}

export interface OutreachPair {
  materialId: string;
  supplierId: string;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .filter((t) => t.length > 2);
}

export function categoriesMatch(supplierCategories: string[], materialCategory: string): boolean {
  const matTokens = new Set(tokens(materialCategory));
  return supplierCategories.some((c) => tokens(c).some((t) => matTokens.has(t)));
}

/** For each material, the matching suppliers (ranked by reliability desc) as flat pairs. */
export function proposeOutreach(
  materials: MatchMaterial[],
  suppliers: MatchSupplier[],
): OutreachPair[] {
  const ranked = [...suppliers].sort((a, b) => b.reliability - a.reliability);
  const pairs: OutreachPair[] = [];
  for (const m of materials) {
    for (const s of ranked) {
      if (categoriesMatch(s.categories, m.category)) {
        pairs.push({ materialId: m.id, supplierId: s.id });
      }
    }
  }
  return pairs;
}
