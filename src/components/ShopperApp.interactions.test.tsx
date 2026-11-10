import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShopperApp } from "./ShopperApp";
import { jsonResponse, model, pathnameOf, products, responseForPath } from "../../tests/shopper-fixtures";

function installDefaultFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openShopper() {
  installDefaultFetch();
  render(<ShopperApp />);
  await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });
}

describe("ShopperApp product interactions", () => {
  it("saves and removes products in the browser-local saved list", async () => {
    const user = userEvent.setup();
    await openShopper();

    await user.click(screen.getByRole("button", { name: `${model.copy.saveProduct}: ${products[0].name}` }));
    expect(await screen.findByText(model.copy.saveComplete)).toBeVisible();
    expect(window.localStorage.getItem(model.app.savedStorageKey)).toContain(products[0].id);

    const navigation = screen.getByRole("navigation", { name: model.copy.primaryNavigation });
    await user.click(within(navigation).getByRole("button", { name: /Saved list/ }));
    expect(await screen.findByRole("heading", { name: model.copy.savedTitle, level: 1 })).toBeVisible();
    expect(screen.getByRole("heading", { name: products[0].name, level: 2 })).toBeVisible();

    await user.click(screen.getByRole("button", { name: `${model.copy.removeSaved}: ${products[0].name}` }));
    expect(await screen.findByText(model.copy.emptySaved)).toBeVisible();
  });

  it("limits comparison to two products, closes the dialog, and clears selection", async () => {
    const user = userEvent.setup();
    await openShopper();

    await user.click(screen.getByRole("button", { name: `${model.copy.compare}: ${products[0].name}` }));
    await user.click(screen.getByRole("button", { name: `${model.copy.compare}: ${products[0].name}` }));
    expect(screen.queryByRole("button", { name: model.copy.clearComparison })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `${model.copy.compare}: ${products[0].name}` }));
    await user.click(screen.getByRole("button", { name: `${model.copy.compare}: ${products[1].name}` }));
    expect(screen.getByRole("button", { name: `${model.copy.compare}: ${products[2].name}` })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Compare selected/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(products[0].name)).toBeVisible();
    expect(within(dialog).getByText(products[1].name)).toBeVisible();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Compare selected/ }));
    const backdrop = document.querySelector(".dialog-backdrop");
    if (!backdrop) throw new Error("The comparison backdrop should be rendered.");
    fireEvent.mouseDown(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Compare selected/ }));
    await user.click(screen.getByRole("button", { name: model.copy.compareClose }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: model.copy.clearComparison }));
    expect(screen.queryByText("2 / 2")).not.toBeInTheDocument();
  });

  it("explains that a second product is needed for side-by-side comparison", async () => {
    const user = userEvent.setup();
    installDefaultFetch();
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
    await screen.findByRole("heading", { name: products[0].name, level: 2 });
    await user.click(screen.getByRole("button", { name: `${model.copy.compare}: ${products[0].name}` }));
    const compareLauncher = document.querySelector(".compare-launch");
    if (!compareLauncher) throw new Error("The search results compare button should be rendered.");
    await user.click(compareLauncher);

    expect(screen.getByRole("dialog")).toHaveTextContent(model.copy.compareEmpty);
  });

  it("sends helpful feedback and shows the returned confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = installDefaultFetch();
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
    await screen.findByRole("heading", { name: products[0].name, level: 2 });

    await user.click(screen.getByRole("button", { name: `${model.copy.feedbackHelpful}: ${products[0].name}` }));
    expect(await screen.findByText(model.copy.feedbackReceived, { selector: ".feedback-thanks" })).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => pathnameOf(input) === "/api/v1/feedback")).toBe(true);
  });

  it("maps feedback API failures to safe copy and retries failed catalog requests", async () => {
    const user = userEvent.setup();
    let catalogRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathnameOf(input);
      if (path === "/api/v1/catalog" && catalogRequests++ === 0) {
        return jsonResponse({ error: { code: "INTERNAL_ERROR" } }, 500);
      }
      if (path === "/api/v1/feedback") {
        return jsonResponse({ error: { code: "INTERNAL_ERROR" } }, 500);
      }
      return responseForPath(path, init);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ShopperApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent(model.copy.errors.server);
    await user.click(screen.getByRole("button", { name: model.copy.retry }));
    await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });

    const searchbox = screen.getByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
    await screen.findByRole("heading", { name: products[0].name, level: 2 });
    await user.click(screen.getByRole("button", { name: `${model.copy.feedbackNotRelevant}: ${products[0].name}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent(model.copy.errors.server);
  });
});
