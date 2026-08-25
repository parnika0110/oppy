"use client";

import { useState } from "react";
import { CATEGORIES, COMMON_LOCATIONS, COMMON_TAGS, Category } from "@/types/opportunity";

const emptyForm = {
  title: "",
  organization: "",
  category: "Internship" as Category,
  location: "Remote",
  tags: [] as string[],
  description: "",
  applicationLink: "",
  imageUrl: "",
  deadline: "",
  source: "",
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setForm((f) =>
      f.tags.includes(tag) ? { ...f, tags: f.tags.filter((t) => t !== tag) } : { ...f, tags: [...f.tags, tag] }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setMismatchWarning(null);

    try {
      const res = await fetch("/api/admin/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          ...form,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Failed to create opportunity." });
        return;
      }

      if (data.flaggedCategoryMismatch && data.item.categoryValidation) {
        setMismatchWarning(
          `AI flagged a possible category mismatch: "${data.item.categoryValidation.reasoning}" ` +
            (data.item.categoryValidation.suggestedCategory
              ? `Suggested category: ${data.item.categoryValidation.suggestedCategory}.`
              : "")
        );
      }

      setResult({ type: "success", message: `Created: "${data.item.title}"` });
      setForm(emptyForm);
    } catch {
      setResult({ type: "error", message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin — Add Opportunity</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI will auto-generate the summary, eligibility, tags, and validate your category choice.
          </p>
        </div>
        <a
          href="/admin/ingestion"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Ingestion Dashboard →
        </a>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Secret</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Paste ADMIN_SECRET"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization *</label>
            <input
              required
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <input
              required
              list="location-suggestions"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <datalist id="location-suggestions">
              {COMMON_LOCATIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags <span className="text-gray-400 font-normal">(optional — AI will suggest if left blank)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  form.tags.includes(tag)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            required
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Paste the full raw description — this is what the AI reads to generate the summary."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Application Link *</label>
          <input
            required
            type="url"
            value={form.applicationLink}
            onChange={(e) => setForm({ ...form, applicationLink: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. Unstop, Devpost"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? "Processing with AI..." : "Create Opportunity"}
        </button>
      </form>

      {mismatchWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
          ⚠ {mismatchWarning}
        </div>
      )}

      {result && (
        <div
          className={`text-sm rounded-lg p-3 ${
            result.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
