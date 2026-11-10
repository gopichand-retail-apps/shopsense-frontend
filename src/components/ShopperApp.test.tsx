import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShopperApp } from "./ShopperApp";
import { envelope, jsonResponse, model, pathnameOf, products, responseForPath } from "../../tests/shopper-fixtures";

function installDefaultFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ShopperApp boot and discovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads the localized model, catalog, saved state, theme, and document metadata", async () => {
    const fetchMock = installDefaultFetch();
    window.localStorage.setItem(model.app.themeStorageKey, "dark");
    window.localStorage.setItem(model.app.savedStorageKey, JSON.stringify([products[0].id, products[0].id]));
    render(<ShopperApp />);

    expect(await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 })).toBeVisible();
    expect(screen.getByText(model.copy.serviceConnected)).toBeVisible();
    expect(screen.getByRole("searchbox", { name: model.copy.searchLabel })).toBeVisible();
    expect(screen.getByRole("button", { name: /Saved list 1/ })).toBeVisible();
    expect(document.title).toBe(`${model.app.name} | ${model.app.descriptor}`);
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      envelope.data.app.description,
    );
    expect(document.querySelector(".shop-shell")).toHaveAttribute("data-theme", "dark");
    expect(fetchMock).toHaveBeenCalledWith("/shopsense-ai-model.json", expect.objectContaining({ cache: "no-store" }));
  });

  it("shows a clear bootstrap failure for an unavailable or invalid model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    const { unmount } = render(<ShopperApp />);
    expect(await screen.findByText("CONTENT_MODEL_UNAVAILABLE")).toBeVisible();

    const invalidModel = { ...envelope, appId: "wrong-app" };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        pathnameOf(input) === "/shopsense-ai-model.json"
          ? jsonResponse(invalidModel)
          : responseForPath(pathnameOf(input)),
      ),
    );
    unmount();
    render(<ShopperApp />);
    expect(await screen.findByText("CONTENT_MODEL_UNAVAILABLE")).toBeVisible();
  });

  it("validates query lengths before making a search request", async () => {
    const user = userEvent.setup();
    const fetchMock = installDefaultFetch();
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });

    await user.type(searchbox, "x");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
    expect(screen.getByRole("alert")).toHaveTextContent(model.copy.searchTooShort);
    expect(fetchMock.mock.calls.some(([input]) => pathnameOf(input) === "/api/v1/search")).toBe(false);

    fireEvent.change(searchbox, {
      target: { value: "x".repeat(model.search.maximumQueryCharacters + 1) },
    });
    const form = searchbox.closest("form");
    if (!form) throw new Error("Search input must be inside a form.");
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(model.copy.searchTooLong);
  });

  it("filters categories and toggles the theme and mobile navigation", async () => {
    const user = userEvent.setup();
    installDefaultFetch();
    render(<ShopperApp />);
    await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });

    await user.click(screen.getByRole("button", { name: /^Audio$/ }));
    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: model.copy.allCategories }));
    expect(screen.getAllByTestId("product-card")).toHaveLength(products.length);

    await user.click(screen.getByRole("button", { name: model.copy.themeToggle }));
    expect(document.querySelector(".shop-shell")).toHaveAttribute("data-theme", "dark");
    await user.click(screen.getByRole("button", { name: model.copy.openNavigation }));
    expect(document.querySelector(".mobile-scrim")).toBeInTheDocument();
    const menuButton = document.querySelector(".mobile-menu-button");
    if (!menuButton) throw new Error("The mobile navigation button should be rendered.");
    await user.click(menuButton);
    expect(document.querySelector(".mobile-scrim")).not.toBeInTheDocument();
  });

  it("shows a clear catalog empty state and supports returning to discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        pathnameOf(input) === "/api/v1/catalog" ? jsonResponse({ data: [] }) : responseForPath(pathnameOf(input)),
      ),
    );
    vi.stubGlobal("scrollTo", vi.fn());
    render(<ShopperApp />);

    expect(await screen.findByText(model.copy.emptyTitle)).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: model.copy.backToDiscover }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("renders no-match recovery and returns to the catalog", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (pathnameOf(input) === "/api/v1/search") {
          return jsonResponse({
            data: {
              intentCategory: null,
              resultCount: 0,
              results: [],
              summary: model.copy.noResultsFor.replace("{query}", "unknown request"),
              source: model.copy.localCatalogSource,
            },
          });
        }
        return responseForPath(pathnameOf(input), init);
      }),
    );
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "unknown request");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));

    expect(await screen.findByRole("heading", { name: model.copy.noMatchesTitle })).toBeVisible();
    await user.click(screen.getByRole("button", { name: model.copy.backToDiscover }));
    expect(await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: model.copy.searchLabel })).toHaveValue("");
  });

  it("uses a quick prompt to submit a search", async () => {
    const user = userEvent.setup();
    const fetchMock = installDefaultFetch();
    render(<ShopperApp />);
    await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });

    await user.click(screen.getByRole("button", { name: /A light pack for weekend trails/ }));

    expect(await screen.findByRole("heading", { name: products[0].name, level: 2 })).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => pathnameOf(input) === "/api/v1/search")).toBe(true);
  });

  it("uses the model search error copy when the request cannot reach the API", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        pathnameOf(input) === "/api/v1/search"
          ? Promise.reject(new TypeError("private transport detail"))
          : Promise.resolve(responseForPath(pathnameOf(input), init)),
      ),
    );
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));

    expect(await screen.findByRole("alert")).toHaveTextContent(model.copy.searchError);
    expect(screen.queryByText("private transport detail")).not.toBeInTheDocument();
  });

  it("keeps the service unavailable if reconnect health checks fail", async () => {
    let healthRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (pathnameOf(input) === "/api/v1/health" && healthRequests++ > 0) {
        return Promise.reject(new TypeError("network unavailable"));
      }
      return Promise.resolve(responseForPath(pathnameOf(input), init));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ShopperApp />);
    expect(await screen.findByText(model.copy.serviceConnected)).toBeVisible();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      const healthCalls = fetchMock.mock.calls.filter(([input]) => pathnameOf(input) === "/api/v1/health");
      expect(healthCalls).toHaveLength(2);
      expect(screen.getByText(model.copy.serviceUnavailable)).toBeVisible();
    });
  });

  it("submits a catalog search and renders only the API recommendation", async () => {
    const user = userEvent.setup();
    const fetchMock = installDefaultFetch();
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });

    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));

    expect(await screen.findByRole("heading", { name: products[0].name, level: 2 })).toBeVisible();
    expect(screen.getByText(products[0].attributes[0])).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => pathnameOf(input) === "/api/v1/search")).toBe(true);
  });

  it("keeps the catalog recoverable when offline and reconnects", async () => {
    installDefaultFetch();
    render(<ShopperApp />);
    expect(await screen.findByText(model.copy.serviceConnected)).toBeVisible();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    expect(await screen.findByText(model.copy.offlineNotice)).toBeVisible();
    expect(screen.getByText(model.copy.serviceUnavailable)).toBeVisible();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.getByText(model.copy.serviceConnected)).toBeVisible());
    expect(screen.queryByText(model.copy.offlineNotice)).not.toBeInTheDocument();
  });

  it("uses safe defaults for corrupted local appearance and saved data", async () => {
    window.localStorage.setItem(model.app.themeStorageKey, "sepia");
    window.localStorage.setItem(model.app.savedStorageKey, "{");
    installDefaultFetch();
    render(<ShopperApp />);

    await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });
    expect(document.querySelector(".shop-shell")).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: /^Saved list$/ })).toBeVisible();
  });

  it("ignores invalid saved-list entries and updates existing document metadata", async () => {
    const description = document.createElement("meta");
    description.name = "description";
    description.content = "old description";
    document.head.append(description);
    window.localStorage.setItem(model.app.savedStorageKey, JSON.stringify([5]));
    installDefaultFetch();
    render(<ShopperApp />);

    await screen.findByRole("heading", { name: model.copy.catalogTitle, level: 2 });
    expect(screen.getByRole("button", { name: /^Saved list$/ })).toBeVisible();
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(description.content).toBe(envelope.data.app.description);
  });

  it("shows the searching status while the API request is pending", async () => {
    const user = userEvent.setup();
    let resolveSearch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (pathnameOf(input) === "/api/v1/search") {
          return new Promise<Response>((resolve) => {
            resolveSearch = resolve;
          });
        }
        return Promise.resolve(responseForPath(pathnameOf(input), init));
      }),
    );
    render(<ShopperApp />);
    const searchbox = await screen.findByRole("searchbox", { name: model.copy.searchLabel });
    await user.type(searchbox, "a light daypack");
    await user.click(screen.getByRole("button", { name: model.copy.searchAction }));

    expect(screen.getByRole("status")).toHaveTextContent(model.copy.searching);
    if (!resolveSearch) throw new Error("The search request should be pending.");
    resolveSearch(
      responseForPath("/api/v1/search", {
        body: JSON.stringify({ query: "a light daypack" }),
      }),
    );
    expect(await screen.findByRole("heading", { name: products[0].name, level: 2 })).toBeVisible();
  });
});
