"use client";

import type { ReactNode } from "react";
import { ArrowRight, Bookmark, Menu, Moon, Server, Sparkles, Sun, X } from "lucide-react";
import { isMock } from "@/config";
import { APP_VERSION } from "@/app-version";
import { copy, type PublicModel, type ThemeMode } from "@/lib/model";

export type WorkspaceView = "discover" | "saved";

interface ShopperShellProps {
  model: PublicModel;
  activeView: WorkspaceView;
  navigationOpen: boolean;
  theme: ThemeMode;
  serviceConnected: boolean;
  savedCount: number;
  onViewChange: (view: WorkspaceView) => void;
  onNavigationChange: (open: boolean) => void;
  onThemeChange: (theme: ThemeMode) => void;
  children: ReactNode;
}

export function ShopperShell({
  model,
  activeView,
  navigationOpen,
  theme,
  serviceConnected,
  savedCount,
  onViewChange,
  onNavigationChange,
  onThemeChange,
  children,
}: ShopperShellProps) {
  const ThemeIcon = theme === "light" ? Moon : Sun;
  const serviceLabel = serviceConnected ? "serviceConnected" : "serviceUnavailable";
  const pageTitle = activeView === "saved" ? copy(model, "savedTitle") : copy(model, "discover");

  return (
    <div className="shop-shell" data-theme={theme} data-mode={isMock ? "mock" : "live"}>
      {navigationOpen && (
        <button
          className="mobile-scrim"
          type="button"
          aria-label={copy(model, "closeNavigation")}
          onClick={() => onNavigationChange(false)}
        />
      )}
      <aside className={navigationOpen ? "shop-sidebar is-open" : "shop-sidebar"}>
        <a className="brand-lockup" href="#discover" onClick={() => onViewChange("discover")}>
          <span className="brand-symbol">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span>{model.app.name}</span>
        </a>
        <div className="sidebar-caption">
          <span className="section-kicker">{copy(model, "eyebrow")}</span>
          <p>{copy(model, "noProvider")}</p>
        </div>
        <nav className="shop-navigation" aria-label={copy(model, "primaryNavigation")}>
          {model.navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={activeView === item.id ? "shop-nav-link is-active" : "shop-nav-link"}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => {
                onViewChange(item.id);
                onNavigationChange(false);
              }}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "saved" && savedCount > 0 && <span className="saved-count">{savedCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="service-indicator">
            <span className={serviceConnected ? "service-dot is-online" : "service-dot"} aria-hidden="true" />
            <span>{copy(model, serviceLabel)}</span>
          </div>
          <p className="sidebar-footnote">{copy(model, "releaseVersion")} {APP_VERSION}</p>
          <p className="sidebar-footnote">{copy(model, "catalogGrounding")}</p>
        </div>
      </aside>

      <main className="shop-main">
        <header className="shop-topbar">
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label={copy(model, navigationOpen ? "closeNavigation" : "openNavigation")}
            aria-expanded={navigationOpen}
            onClick={() => onNavigationChange(!navigationOpen)}
          >
            {navigationOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <div className="breadcrumb">
            <span>{model.app.descriptor}</span>
            <ArrowRight size={13} aria-hidden="true" />
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-tools">
            <span className="service-label">
              <Server size={13} aria-hidden="true" />
              {copy(model, "catalogSource")}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={copy(model, "themeToggle")}
              onClick={() => onThemeChange(theme === "light" ? "dark" : "light")}
            >
              <ThemeIcon size={17} aria-hidden="true" />
            </button>
          </div>
        </header>
        <section className="shop-content">
          {children}
          <footer className="shop-footer">
            <span>{copy(model, "footerNote")}</span>
            <span>
              <Server size={13} aria-hidden="true" /> {copy(model, "catalogGrounding")}
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function NavigationIcon({ name }: { name: string }) {
  if (name === "Bookmark") return <Bookmark size={16} aria-hidden="true" />;
  return <Sparkles size={16} aria-hidden="true" />;
}
