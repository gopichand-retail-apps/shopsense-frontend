"use client";

import { copy, type PublicModel, type SearchResult } from "@/lib/model";

export function SearchAssistance({ model, available }: { model: PublicModel; available: boolean }) {
  return (
    <div className="search-assistance">
      <p>{copy(model, available ? "aiSearchReady" : "aiSearchUnavailable")}</p>
      <details>
        <summary>{copy(model, "searchPrivacy")}</summary>
        <p id="ai-search-disclosure">{copy(model, "aiSearchDisclosure")}</p>
        <p id="voice-disclosure">{copy(model, "voicePrivacy")}</p>
      </details>
    </div>
  );
}

export function SearchAssistanceStatus({ model, result }: { model: PublicModel; result: SearchResult }) {
  const status = result.assistance?.status ?? "catalog";
  const key =
    status === "assisted" ? "aiSearchUsed" : status === "unavailable" ? "aiSearchFallback" : "catalogSearchUsed";
  return (
    <p className="assistance-status" role="status" data-provider={result.assistance?.provider ?? "local"}>
      <span>{copy(model, key)}</span>
      {status === "assisted" && (
        <strong className="provider-label">
          {copy(model, result.assistance?.provider === "ollama" ? "ollamaProviderLabel" : "geminiProviderLabel")}
        </strong>
      )}
    </p>
  );
}
