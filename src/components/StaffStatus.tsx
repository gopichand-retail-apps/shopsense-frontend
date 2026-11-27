"use client";

import { ArrowLeft, DatabaseZap, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { getFeedStatus, loadModel, type FeedStatus } from "@/lib/api";
import { copy, copyWith, formatDateTime, type PublicModel, type ThemeMode } from "@/lib/model";

type StaffState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; status: FeedStatus };

const headings = { empty: "staffOnboardingTitle", ready: "staffReadyTitle", stale: "staffStaleTitle" } as const;

function readTheme(model: PublicModel): ThemeMode {
  const stored = window.localStorage.getItem(model.app.themeStorageKey);
  return stored === "dark" || stored === "light" ? stored : model.app.defaultTheme;
}

// Read-only feed status for store staff. This local build has no sign-in, so it exposes counts and times only.
export function StaffStatus() {
  const [model, setModel] = useState<PublicModel | null>(null);
  const [modelError, setModelError] = useState(false);
  const [state, setState] = useState<StaffState>({ kind: "loading" });

  const refresh = useCallback(async (current: PublicModel, signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const status = await getFeedStatus(current, signal);
      if (!signal?.aborted) setState({ kind: "ready", status });
    } catch {
      if (!signal?.aborted) setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadModel(controller.signal)
      .then((loaded) => {
        setModel(loaded);
        return refresh(loaded, controller.signal);
      })
      .catch(() => {
        if (!controller.signal.aborted) setModelError(true);
      });
    return () => controller.abort();
  }, [refresh]);

  if (!model) {
    return (
      <main className="boot-state" role={modelError ? "alert" : "status"}>
        {modelError ? <code>CONTENT_MODEL_UNAVAILABLE</code> : <span className="loading-orbit" aria-hidden="true" />}
      </main>
    );
  }
  return (
    <main className="staff-page" data-theme={readTheme(model)}>
      <div className="staff-panel">
        <span className="page-overline">{copy(model, "staffEyebrow")}</span>
        <h1>{copy(model, "staffTitle")}</h1>
        <StaffBody model={model} state={state} onRetry={() => void refresh(model)} />
        <p className="staff-notice">{copy(model, "staffLocalNotice")}</p>
        <Link className="text-action staff-back" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          {copy(model, "staffBack")}
        </Link>
      </div>
    </main>
  );
}

function StaffBody({ model, state, onRetry }: { model: PublicModel; state: StaffState; onRetry: () => void }) {
  if (state.kind === "loading") {
    return (
      <div className="search-status" role="status" aria-live="polite">
        <span className="loading-orbit" aria-hidden="true" />
        <span>{copy(model, "loadingCatalog")}</span>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="error-panel" role="alert">
        <p>{copy(model, "staffLoadError")}</p>
        <button className="text-action" type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          {copy(model, "retry")}
        </button>
      </div>
    );
  }
  const { status } = state;
  const Icon = status.state === "ready" ? DatabaseZap : TriangleAlert;
  return (
    <section className={`staff-status staff-status-${status.state}`} aria-labelledby="staff-status-heading">
      <h2 id="staff-status-heading">
        <Icon size={20} aria-hidden="true" />
        {copy(model, headings[status.state])}
      </h2>
      {status.state === "empty" ? <p>{copy(model, "staffOnboardingDescription")}</p> : null}
      <dl className="staff-facts">
        <Fact label={copy(model, "staffOfferCount")} value={String(status.offerCount)} />
        <Fact label={copy(model, "staffWithdrawnCount")} value={String(status.withdrawnCount)} />
        <Fact label={copy(model, "staffLocationCount")} value={String(status.locationCount)} />
        <Fact
          label={copy(model, "staffLastUpdate")}
          value={status.asOf ? formatDateTime(model, status.asOf) : copy(model, "staffNever")}
        />
      </dl>
      <p className="staff-limit">{copyWith(model, "staffFreshnessLimit", { minutes: status.maxAgeMinutes })}</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div>
      <dt id={id}>{label}</dt>
      <dd aria-labelledby={id}>{value}</dd>
    </div>
  );
}
