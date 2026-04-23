"use client";

import { useState } from "react";

interface Props {
  onSubmit: (address: string) => void;
  loading: boolean;
}

const SAMPLES = [
  "東京都千代田区千代田1-1",
  "大阪府大阪市北区梅田3-1-3",
  "静岡県静岡市清水区港町1-1",
];

export default function AddressForm({ onSubmit, loading }: Props) {
  const [address, setAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim().length >= 3 && !loading) {
      onSubmit(address.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label className="block text-sm font-medium text-ink mb-2">
        調査したい事業所の住所を入力してください
      </label>
      <div className="flex flex-col md:flex-row gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="例）東京都千代田区千代田1-1"
          className="flex-1 px-4 py-3 border border-ink/20 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/40"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || address.trim().length < 3}
          className="px-6 py-3 bg-navy text-white rounded-lg font-medium hover:bg-navy/90 disabled:bg-ink/20 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "調査中…" : "災害リスクを調べる"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/60">
        <span>サンプル：</span>
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setAddress(s)}
            className="underline hover:text-navy disabled:opacity-50"
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}
