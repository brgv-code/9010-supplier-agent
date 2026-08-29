export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function Skeleton({ w, h }: { w?: string; h?: string }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

export function FullPageLoader() {
  return (
    <div className="fullpage">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <p className="muted">Loading…</p>
    </div>
  );
}
