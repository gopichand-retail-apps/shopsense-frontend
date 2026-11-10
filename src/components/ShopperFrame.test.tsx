import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { model } from "../../tests/shopper-fixtures";
import { ShopperFrame } from "./ShopperFrame";

describe("ShopperFrame", () => {
  afterEach(() => {
    window.removeEventListener("shopsense:navigate", onNavigate);
    window.removeEventListener("shopsense:toggle-theme", onThemeToggle);
  });

  const onNavigate = vi.fn();
  const onThemeToggle = vi.fn();

  it("emits navigation and theme actions and controls the mobile menu", async () => {
    const user = userEvent.setup();
    window.addEventListener("shopsense:navigate", onNavigate);
    window.addEventListener("shopsense:toggle-theme", onThemeToggle);
    render(
      <ShopperFrame model={model} theme="light" activeView="discover" serviceConnected savedCount={1}>
        <p>Frame content</p>
      </ShopperFrame>,
    );

    expect(screen.getByText("Frame content")).toBeVisible();
    await user.click(screen.getByRole("button", { name: model.copy.openNavigation }));
    const menuButton = document.querySelector(".mobile-menu-button");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: /Saved list/ }));
    expect(onNavigate).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: model.copy.themeToggle }));
    expect(onThemeToggle).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: model.copy.openNavigation }));
    expect(document.querySelector(".mobile-scrim")).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the saved workspace and disconnected service state", () => {
    render(
      <ShopperFrame model={model} theme="dark" activeView="saved" serviceConnected={false} savedCount={0}>
        <p>Saved frame content</p>
      </ShopperFrame>,
    );

    expect(screen.getByText(model.copy.savedTitle)).toBeVisible();
    expect(screen.getByText(model.copy.serviceUnavailable)).toBeVisible();
    expect(screen.getByRole("button", { name: model.copy.saved })).toHaveAttribute("aria-current", "page");
  });
});
