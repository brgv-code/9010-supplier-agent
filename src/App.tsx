import { useAuthActions } from "@convex-dev/auth/react";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { type ChangeEvent, type DragEvent, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import SignIn from "./SignIn";

// Gate the whole app on auth.
export default function App() {
  return (
    <>
      <AuthLoading>
        <main className="wrap">
          <p className="muted">Loading...</p>
        </main>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <TenderViewer />
      </Authenticated>
    </>
  );
}

function TenderViewer() {
  const { signOut } = useAuthActions();
  const tenders = useQuery(api.ingest.listTenders); // undefined while loading
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const ingest = useAction(api.ingestActions.ingestUploadedX83);
  const ingestPdf = useAction(api.ingestPdfActions.ingestUploadedPdf);
  const extract = useAction(api.extractActions.extractMaterialsForTender);
  const seedSuppliers = useMutation(api.suppliers.seedSuppliers);
  const matchSuppliers = useMutation(api.suppliers.matchSuppliers);
  const approveOutreach = useMutation(api.suppliers.approveOutreach);
  const sendOutreach = useMutation(api.outreach.sendOutreach);

  const [selected, setSelected] = useState<Id<"tenders"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [outreachBusy, setOutreachBusy] = useState(false);

  const positions = useQuery(api.ingest.listPositions, selected ? { tenderId: selected } : "skip");
  const materials = useQuery(
    api.extract.listMaterialReqs,
    selected ? { tenderId: selected } : "skip",
  );
  const suppliers = useQuery(api.suppliers.listSuppliers);
  const outreach = useQuery(api.suppliers.listOutreach, selected ? { tenderId: selected } : "skip");
  const emails = useQuery(
    api.outreach.listOutboundEmails,
    selected ? { tenderId: selected } : "skip",
  );
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
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const result = isPdf
        ? await ingestPdf({ fileId: storageId as Id<"_storage"> })
        : await ingest({ fileId: storageId as Id<"_storage"> });
      setSelected(result.tenderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onExtract() {
    if (!selected) return;
    setExtracting(true);
    setError(null);
    try {
      await extract({ tenderId: selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  async function onMatch() {
    if (!selected) return;
    setOutreachBusy(true);
    setError(null);
    try {
      if (!suppliers || suppliers.length === 0) await seedSuppliers({});
      await matchSuppliers({ tenderId: selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutreachBusy(false);
    }
  }

  async function onApprove() {
    if (!selected) return;
    setOutreachBusy(true);
    setError(null);
    try {
      await approveOutreach({ tenderId: selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutreachBusy(false);
    }
  }

  async function onSend() {
    if (!selected) return;
    setOutreachBusy(true);
    setError(null);
    try {
      await sendOutreach({ tenderId: selected });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutreachBusy(false);
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
      <header className="topbar">
        <div>
          <h1>Tender viewer</h1>
          <p className="sub">
            Upload a GAEB X83 (parsed) or a PDF tender (AI-extracted), then extract material needs.
          </p>
        </div>
        <button type="button" className="linkbtn" onClick={() => void signOut()}>
          Sign out
        </button>
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
        <input
          id="file"
          type="file"
          accept=".x83,.xml,.pdf"
          onChange={onInput}
          disabled={busy}
          hidden
        />
        <label htmlFor="file">
          {busy ? "Parsing..." : "Drop an .x83 or .pdf here, or click to choose"}
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
                    {t.source === "pdf" ? "PDF" : `GAEB X${t.phase}`} · {t.positionCount} positions
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
                    {selectedTender.source === "pdf"
                      ? "PDF (AI-extracted)"
                      : `GAEB ${selectedTender.gaebVersion} · X${selectedTender.phase}`}{" "}
                    · {selectedTender.currency || "?"} · {selectedTender.positionCount} positions
                    {tbdCount > 0 ? ` · ${tbdCount} qty TBD` : ""}
                  </span>
                </div>
                <div className="actions">
                  <input
                    className="filter"
                    type="search"
                    placeholder="Filter by OZ or text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <button type="button" className="btn" onClick={onExtract} disabled={extracting}>
                    {extracting ? "Extracting..." : "Extract materials (AI)"}
                  </button>
                </div>
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
                      <th className="num">Conf</th>
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
                        <td
                          className={`num ${p.confidence !== undefined && p.confidence < 0.6 ? "low" : ""}`}
                        >
                          {p.confidence === undefined ? "-" : `${Math.round(p.confidence * 100)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {materials && materials.length > 0 && (
                <div className="materials">
                  <h3>Extracted materials ({materials.length})</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Category</th>
                        <th className="num">Qty</th>
                        <th>Unit</th>
                        <th className="num">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m) => (
                        <tr key={m._id}>
                          <td>{m.description}</td>
                          <td>{m.category}</td>
                          <td className="num">{m.qty === null ? "-" : m.qty}</td>
                          <td>{m.unit}</td>
                          <td className={`num ${m.confidence < 0.6 ? "low" : ""}`}>
                            {Math.round(m.confidence * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted">
                    Rows under 60% confidence (highlighted) are the ones a human would review.
                  </p>
                </div>
              )}

              {materials && materials.length > 0 && (
                <div className="materials">
                  <div className="summary">
                    <h3>Supplier outreach</h3>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={onMatch}
                        disabled={outreachBusy}
                      >
                        {outreachBusy ? "..." : "Match suppliers"}
                      </button>
                      {outreach && outreach.length > 0 && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            onClick={onApprove}
                            disabled={
                              outreachBusy ||
                              selectedTender.status === "outreach_approved" ||
                              selectedTender.status === "outreach_sent"
                            }
                          >
                            {selectedTender.status === "outreach_approved" ||
                            selectedTender.status === "outreach_sent"
                              ? "Approved ✓"
                              : `Approve (${outreach.length})`}
                          </button>
                          {(selectedTender.status === "outreach_approved" ||
                            selectedTender.status === "outreach_sent") && (
                            <button
                              type="button"
                              className="btn"
                              onClick={onSend}
                              disabled={outreachBusy || selectedTender.status === "outreach_sent"}
                            >
                              {selectedTender.status === "outreach_sent"
                                ? "Sent ✓"
                                : `Send RFQs (${outreach.length})`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {outreach && outreach.length === 0 && (
                    <p className="muted">
                      No outreach yet. "Match suppliers" seeds a few sample suppliers (first time)
                      and pairs them to the materials.
                    </p>
                  )}
                  {outreach?.map((g) => (
                    <div key={g.supplierId} className="rfq">
                      <div>
                        <strong>{g.supplier}</strong>{" "}
                        <span className="meta">
                          {g.email} · {g.materials.length} materials · {g.status}
                        </span>
                      </div>
                      <div className="muted">{g.materials.join(", ")}</div>
                    </div>
                  ))}
                  {outreach && outreach.length > 0 && (!emails || emails.length === 0) && (
                    <p className="muted">
                      Approve, then Send. (Simulated send: emails are recorded and tracked, not
                      actually delivered.)
                    </p>
                  )}

                  {emails && emails.length > 0 && (
                    <div className="emails">
                      <h4>Sent RFQs ({emails.length})</h4>
                      {emails.map((e) => (
                        <div key={e._id} className="rfq">
                          <div>
                            <strong>{e.supplierName}</strong>{" "}
                            <span className="meta">
                              {e.email} ·{" "}
                              <span className={e.status === "reminded" ? "low" : ""}>
                                {e.status}
                              </span>
                            </span>
                          </div>
                          <div className="meta">{e.subject}</div>
                        </div>
                      ))}
                      <p className="muted">
                        Status flips "sent" → "reminded" after the (demo) timeout via Convex's
                        durable scheduler. Inbound replies + quote parsing are M4.
                      </p>
                    </div>
                  )}
                </div>
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
