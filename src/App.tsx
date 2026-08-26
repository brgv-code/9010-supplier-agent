import { useAction, useMutation, useQuery } from "convex/react";
import { type ChangeEvent, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export default function App() {
  const tenders = useQuery(api.ingest.listTenders) ?? [];
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const ingest = useAction(api.ingestActions.ingestUploadedX83);

  const [selected, setSelected] = useState<Id<"tenders"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const positions =
    useQuery(api.ingest.listPositions, selected ? { tenderId: selected } : "skip") ?? [];
  const selectedTender = tenders.find((t) => t._id === selected);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/xml" },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: string };
      const result = await ingest({ fileId: storageId as Id<"_storage"> });
      setSelected(result.tenderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>Tender viewer</h1>
        <p className="sub">Upload a GAEB X83 and see its positions. 9010 supplier-agent, M0.</p>
      </header>

      <label className="upload">
        <input type="file" accept=".x83,.xml" onChange={onUpload} disabled={busy} />
        <span>{busy ? "Parsing..." : "Upload .x83"}</span>
      </label>
      {error && <p className="error">{error}</p>}

      <div className="cols">
        <section className="tenders">
          <h2>Tenders</h2>
          {tenders.length === 0 && <p className="muted">None yet. Upload one above.</p>}
          <ul>
            {tenders.map((t) => (
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
          <h2>Positions {selectedTender ? `— ${selectedTender.projectName}` : ""}</h2>
          {!selected && <p className="muted">Select a tender.</p>}
          {selected && positions.length > 0 && (
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
                {positions.map((p) => (
                  <tr key={p._id}>
                    <td className="mono">{p.oz}</td>
                    <td>{p.shortText}</td>
                    <td className="num">{p.qty === null ? "TBD" : p.qty}</td>
                    <td>{p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
