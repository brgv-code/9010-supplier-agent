import { type ChangeEvent, type DragEvent, useState } from "react";
import { Spinner } from "./ui";

export default function Dropzone({
  onFile,
  busy,
}: {
  onFile: (f: File) => void;
  busy: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`dropzone${dragOver ? " over" : ""}${busy ? " busy" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={drop}
    >
      <input id="file" type="file" accept=".x83,.xml,.pdf" hidden onChange={pick} disabled={busy} />
      <label htmlFor="file">
        <span className="dz-icon">
          {busy ? (
            <Spinner />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </span>
        <span className="dz-title">
          {busy ? "Parsing tender…" : "Drop a tender file here, or click to browse"}
        </span>
        <span className="dz-sub">GAEB .x83 (parsed) or PDF (AI-extracted)</span>
      </label>
      {busy && (
        <div className="dz-progress">
          <div className="dz-bar" />
        </div>
      )}
    </div>
  );
}
