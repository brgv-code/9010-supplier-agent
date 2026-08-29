import { Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Dropzone from "../components/Dropzone";
import { Skeleton } from "../components/ui";

export default function Dashboard() {
  const tenders = useQuery(api.ingest.listTenders);
  const generateUploadUrl = useMutation(api.ingest.generateUploadUrl);
  const ingest = useAction(api.ingestActions.ingestUploadedX83);
  const ingestPdf = useAction(api.ingestPdfActions.ingestUploadedPdf);
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
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
      navigate({ to: "/tenders/$tenderId", params: { tenderId: result.tenderId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Tenders</h1>
        <p className="sub">
          Upload a construction tender to extract its materials and reach out to suppliers.
        </p>
      </div>

      <Dropzone onFile={onFile} busy={busy} />
      {error && <p className="error">{error}</p>}

      {tenders === undefined ? (
        <div className="grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card tendercard">
              <Skeleton w="70%" h="1rem" />
              <Skeleton w="45%" h="0.7rem" />
            </div>
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <div className="empty">No tenders yet. Upload one above to get started.</div>
      ) : (
        <div className="grid">
          {tenders.map((t) => (
            <Link
              key={t._id}
              to="/tenders/$tenderId"
              params={{ tenderId: t._id }}
              className="card tendercard"
            >
              <strong>{t.projectName || "(untitled)"}</strong>
              <span className="meta">
                {t.source === "pdf" ? "PDF" : `GAEB X${t.phase}`} · {t.positionCount} positions
              </span>
              <span className="pill">{t.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
