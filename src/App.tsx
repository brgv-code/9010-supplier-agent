import { useAction, useMutation, useQuery } from "convex/react";
import { type ChangeEvent, type DragEvent, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export default function App() {
  const tenders = useQuery(api.ingest.listTenders); // undefined while loading
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const ingest = useAction(api.ingestActions.ingestUploadedX83);

  const [selected, setSelected] = useState<Id<"tenders"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState("");

  const positions = useQuery(api.ingest.listPositions, selected ? { tenderId: selected } : "skip");
  const selectedTender = tenders?.find((t) => t._id === selected) ?? null;

  async function ingestFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/xml" },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: string };
      const result = await ingest({ fileId: storageId as Id<"_storage"> });
      setSelected(result.tenderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
    e.target.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  const allPositions = positions ?? [];
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? allPositions.filter(
        (p) => p.oz.toLowerCase().includes(q) || p.shortText.toLowerCase().includes(q),
      )
    : allPositions;
  const tbdCount = allPositions.filter((p) => p.kind === "qtyTBD").length;

  return (
    <main className="wrap">
      <header>
        <h1>Tender viewer</h1>
        <p className="sub">Upload a GAEB X83 and inspect its positions. 9010 supplier-agent, M0.</p>
      </header>

      <div
        className={`drop ${dragOver ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input id="file" type="file" accept=".x83,.xml" onChange={onInput} disabled={busy} hidden />
        <label htmlFor="file">
          {busy ? "Parsing..." : "Drop an .x83 here, or click to choose"}
        </label>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="cols">
        <section className="tenders">
          <h2>Tenders</h2>
          {tenders === undefined && <p className="muted">Loading...</p>}
          {tenders?.length === 0 && <p className="muted">None yet. Upload one above.</p>}
          <ul>
            {tenders?.map((t) => (
              <li key={t._id}>
                <button
                  type="button"
                  className={t._id === selected ? "active" : ""}
                  onClick={() => setSelected(t._id)}
                >
                  <strong>{t.projectName || "(untitled)"}</strong>
                  <span className="meta">
                    X{t.phase} · {t.positionCount} positions · {t.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="positions">
          {selectedTender ? (
            <>
              <div className="summary">
                <div>
                  <h2>{selectedTender.projectName || "(untitled)"}</h2>
                  <span className="meta">
                    GAEB {selectedTender.gaebVersion} · X{selectedTender.phase} ·{" "}
                    {selectedTender.currency} · {selectedTender.positionCount} positions
                    {tbdCount > 0 ? ` · ${tbdCount} qty TBD` : ""}
                  </span>
                </div>
                <input
                  className="filter"
                  type="search"
                  placeholder="Filter by OZ or text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              {positions === undefined ? (
                <p className="muted">Loading positions...</p>
              ) : filtered.length === 0 ? (
                <p className="muted">{q ? `No positions match "${filter}".` : "No positions."}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>OZ</th>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p._id}>
                        <td className="mono">{p.oz}</td>
                        <td>
                          {p.shortText}
                          {p.kind === "qtyTBD" && <span className="badge">TBD</span>}
                        </td>
                        <td className="num">{p.qty === null ? "-" : p.qty}</td>
                        <td>{p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p className="muted">Select a tender to see its positions.</p>
          )}
        </section>
      </div>
    </main>
  );
}
