import { Link, useParams } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Skeleton, Spinner } from "../components/ui";

export default function TenderDetail() {
  const { tenderId } = useParams({ from: "/tenders/$tenderId" });
  const id = tenderId as Id<"tenders">;

  const tenders = useQuery(api.ingest.listTenders);
  const tender = tenders?.find((t) => t._id === id) ?? null;
  const positions = useQuery(api.ingest.listPositions, { tenderId: id });
  const materials = useQuery(api.extract.listMaterialReqs, { tenderId: id });
  const suppliers = useQuery(api.suppliers.listSuppliers);
  const outreach = useQuery(api.suppliers.listOutreach, { tenderId: id });
  const emails = useQuery(api.outreach.listOutboundEmails, { tenderId: id });

  const extract = useAction(api.extractActions.extractMaterialsForTender);
  const seedSuppliers = useMutation(api.suppliers.seedSuppliers);
  const matchSuppliers = useMutation(api.suppliers.matchSuppliers);
  const approveOutreach = useMutation(api.suppliers.approveOutreach);
  const removeSupplier = useMutation(api.suppliers.removeOutreachSupplier);
  const sendOutreach = useMutation(api.outreach.sendOutreach);

  const [filter, setFilter] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guard(fn: () => Promise<unknown>, setter: (b: boolean) => void) {
    setter(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setter(false);
    }
  }

  const onExtract = () => guard(() => extract({ tenderId: id }), setExtracting);
  const onMatch = () =>
    guard(async () => {
      if (!suppliers || suppliers.length === 0) await seedSuppliers({});
      await matchSuppliers({ tenderId: id });
    }, setOutreachBusy);
  const onApprove = () => guard(() => approveOutreach({ tenderId: id }), setOutreachBusy);
  const onSend = () => guard(() => sendOutreach({ tenderId: id }), setOutreachBusy);
  const onRemove = (supplierId: Id<"suppliers">) =>
    guard(() => removeSupplier({ tenderId: id, supplierId }), setOutreachBusy);

  const q = filter.trim().toLowerCase();
  const allPositions = positions ?? [];
  const filtered = q
    ? allPositions.filter(
        (p) => p.oz.toLowerCase().includes(q) || p.shortText.toLowerCase().includes(q),
      )
    : allPositions;

  if (tenders !== undefined && !tender) {
    return (
      <div className="page">
        <Link to="/" className="linkbtn">
          ← Back to tenders
        </Link>
        <div className="empty">Tender not found.</div>
      </div>
    );
  }

  const sent = tender?.status === "outreach_sent";
  const approved = tender?.status === "outreach_approved" || sent;

  return (
    <div className="page">
      <Link to="/" className="linkbtn">
        ← Back to tenders
      </Link>

      <div className="page-head detail-head">
        <div>
          <h1>{tender?.projectName ?? <Skeleton w="16rem" h="1.4rem" />}</h1>
          {tender && (
            <p className="sub">
              {tender.source === "pdf"
                ? "PDF (AI-extracted)"
                : `GAEB ${tender.gaebVersion} · X${tender.phase}`}{" "}
              · {tender.currency || "?"} · {tender.positionCount} positions · {tender.status}
            </p>
          )}
        </div>
        <button type="button" className="btn" onClick={onExtract} disabled={extracting}>
          {extracting ? <Spinner label="Extracting…" /> : "Extract materials (AI)"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {/* Positions */}
      <section className="card">
        <div className="card-head">
          <h2>Positions</h2>
          <input
            className="filter"
            type="search"
            placeholder="Filter by OZ or text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {positions === undefined ? (
          <Skeleton h="8rem" />
        ) : filtered.length === 0 ? (
          <p className="muted">{q ? `No positions match "${filter}".` : "No positions."}</p>
        ) : (
          <div className="tablewrap">
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
          </div>
        )}
      </section>

      {/* Materials */}
      {materials && materials.length > 0 && (
        <section className="card">
          <h2>Extracted materials ({materials.length})</h2>
          <div className="tablewrap">
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
          </div>
          <p className="muted">Rows under 60% confidence are the ones a human would review.</p>
        </section>
      )}

      {/* Outreach */}
      {materials && materials.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Supplier outreach</h2>
            <div className="actions">
              <button type="button" className="btn" onClick={onMatch} disabled={outreachBusy}>
                {outreachBusy ? <Spinner /> : "Match suppliers"}
              </button>
              {outreach && outreach.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={onApprove}
                    disabled={outreachBusy || approved}
                  >
                    {approved ? "Approved ✓" : `Approve (${outreach.length})`}
                  </button>
                  {approved && (
                    <button
                      type="button"
                      className="btn"
                      onClick={onSend}
                      disabled={outreachBusy || sent}
                    >
                      {sent ? "Sent ✓" : `Send RFQs (${outreach.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {outreach && outreach.length === 0 && (
            <p className="muted">
              "Match suppliers" seeds a few sample suppliers (first time) and pairs them to the
              materials by category.
            </p>
          )}

          {outreach?.map((g) => (
            <div key={g.supplierId} className="rfq">
              <div className="rfqhead">
                <span>
                  <strong>{g.supplier}</strong>{" "}
                  <span className="meta">
                    {g.email} · {g.materials.length} materials · {g.status}
                  </span>
                </span>
                {!sent && (
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => void onRemove(g.supplierId as Id<"suppliers">)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="muted">{g.materials.join(", ")}</div>
            </div>
          ))}

          {outreach && outreach.length > 0 && (!emails || emails.length === 0) && (
            <p className="muted">
              Review, remove any suppliers you don't want, then Approve and Send. (Simulated send:
              recorded and tracked, not actually delivered.)
            </p>
          )}

          {emails && emails.length > 0 && (
            <div className="emails">
              <h4>Sent RFQs ({emails.length})</h4>
              {emails.map((e) => (
                <div key={e._id} className="rfq">
                  <div className="rfqhead">
                    <span>
                      <strong>{e.supplierName}</strong> <span className="meta">{e.email}</span>
                    </span>
                    <span className={`pill ${e.status === "reminded" ? "pill-warn" : ""}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="meta">{e.subject}</div>
                </div>
              ))}
              <p className="muted">
                Status flips "sent" → "reminded" after the (demo) timeout via Convex's durable
                scheduler. Inbound replies + quote parsing are M4.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
