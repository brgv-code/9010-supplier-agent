import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "../components/ui";

export default function Suppliers() {
  const suppliers = useQuery(api.suppliers.listSuppliers);
  const addSupplier = useMutation(api.suppliers.addSupplier);
  const seedSuppliers = useMutation(api.suppliers.seedSuppliers);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState("");
  const [region, setRegion] = useState("Berlin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addSupplier({
        name,
        email,
        region,
        categories: categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });
      setName("");
      setEmail("");
      setCategories("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Suppliers</h1>
        <p className="sub">
          Your catalog. Matching pairs a tender's materials to these by category.
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Catalog</h2>
          {suppliers && suppliers.length === 0 && (
            <button type="button" className="btn" onClick={() => void seedSuppliers({})}>
              Seed samples
            </button>
          )}
        </div>
        {suppliers === undefined ? (
          <Skeleton h="6rem" />
        ) : suppliers.length === 0 ? (
          <p className="muted">No suppliers yet. Add one below or seed samples.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Categories</th>
                  <th>Region</th>
                  <th className="num">Reliability</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td className="meta">{s.email}</td>
                    <td>{s.categories.join(", ")}</td>
                    <td>{s.region}</td>
                    <td className="num">{Math.round(s.reliability * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Add supplier</h2>
        <form className="form-grid" onSubmit={onAdd}>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Categories (comma separated)"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
          />
          <input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Adding…" : "Add supplier"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
