import { useEffect, useState, type FormEvent } from "react";
import { listAssets, createAsset, updateAsset, deleteAsset, type Asset } from "../api/assets";
import {
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  dangerTextClass,
} from "../lib/ui";

const emptyForm = {
  name: "",
  type: "",
  currency: "USD",
  currentValue: "",
  purchasePrice: "",
  purchaseDate: "",
};

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await listAssets();
    setAssets(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        type: form.type || undefined,
        currency: form.currency,
        currentValue: Number(form.currentValue),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        purchaseDate: form.purchaseDate || undefined,
      };
      if (editingId) {
        await updateAsset(editingId, payload);
      } else {
        await createAsset(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function startEdit(asset: Asset) {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      type: asset.type ?? "",
      currency: asset.currency,
      currentValue: asset.currentValue,
      purchasePrice: asset.purchasePrice ?? "",
      purchaseDate: asset.purchaseDate ?? "",
    });
  }

  async function handleDelete(id: string) {
    await deleteAsset(id);
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assets</h1>

      <form onSubmit={handleSubmit} className={`grid grid-cols-1 gap-3 sm:grid-cols-4 ${cardClass}`}>
        <div>
          <label htmlFor="asset-name" className={labelClass}>Name</label>
          <input
            id="asset-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="asset-type" className={labelClass}>Type</label>
          <input
            id="asset-type"
            type="text"
            placeholder="vehicle, property, ..."
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="asset-currency" className={labelClass}>Currency</label>
          <input
            id="asset-currency"
            type="text"
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="asset-current-value" className={labelClass}>Current value</label>
          <input
            id="asset-current-value"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.currentValue}
            onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="asset-purchase-price" className={labelClass}>Purchase price</label>
          <input
            id="asset-purchase-price"
            type="number"
            step="0.01"
            min="0"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="asset-purchase-date" className={labelClass}>Purchase date</label>
          <input
            id="asset-purchase-date"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            className={inputClass}
          />
        </div>
        {error && <p className={`sm:col-span-4 ${dangerTextClass}`}>{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className={primaryButtonClass}>
            {editingId ? "Save changes" : "Add asset"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className={secondaryButtonClass}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No assets yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {assets.map((asset) => (
            <div key={asset.id} className={cardClass}>
              <h2 className="font-semibold text-slate-900 dark:text-white">{asset.name}</h2>
              {asset.type && <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">{asset.type}</p>}
              <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                <dt className="text-slate-500">Current value</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">
                  {asset.currentValue} {asset.currency}
                </dd>
                {asset.purchasePrice && (
                  <>
                    <dt className="text-slate-500">Purchase price</dt>
                    <dd className="text-right">
                      {asset.purchasePrice} {asset.currency}
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex gap-3 text-sm">
                <button
                  onClick={() => startEdit(asset)}
                  aria-label={`Edit ${asset.name}`}
                  className="text-fuchsia-600 dark:text-fuchsia-400 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(asset.id)}
                  aria-label={`Delete ${asset.name}`}
                  className="text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
