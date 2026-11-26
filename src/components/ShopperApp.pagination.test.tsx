import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ShopperApp } from "./ShopperApp";
import {
  envelope,
  jsonResponse,
  model,
  offerPage,
  offerSearch,
  pathnameOf,
  products,
  responseForPath,
} from "../../tests/shopper-fixtures";

const catalog = Array.from({ length: 60 }, (_, index) => ({
  ...products[index % products.length],
  id: `pagination-${index}`,
  name: `Catalog item ${index}`,
}));

function installCatalog() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      "http://localhost",
    );
    if (url.pathname === "/shopsense-ai-model.json") return jsonResponse(envelope);
    if (url.pathname === "/api/v1/health")
      return jsonResponse({
        data: {
          status: "ok",
          service: "shopsense-api",
          storage: "sqlite",
          catalogCount: catalog.length,
        },
      });
    if (url.pathname === "/api/v2/catalog") {
      const ids = url.searchParams.get("ids")?.split(",");
      const category = url.searchParams.get("category");
      const selected = catalog.filter(
        (product) => (!ids || ids.includes(product.id)) && (!category || product.category === category),
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = selected.slice(offset, offset + Number(url.searchParams.get("limit") ?? 24));
      const unavailableIds = (ids ?? []).filter((id) => !items.some((product) => product.id === id));
      return jsonResponse(offerPage(items, { total: selected.length, unavailableIds }));
    }
    if (url.pathname === "/api/v2/search") {
      const product = structuredClone(catalog[59]);
      Reflect.deleteProperty(product, "matchTags");
      return jsonResponse(offerSearch("find a product", [product], { summary: "A catalog match." }));
    }
    return responseForPath(pathnameOf(input), init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("loads bounded pages and removes the paging control after the last page", async () => {
  installCatalog();
  const user = userEvent.setup();
  render(<ShopperApp />);
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(24));
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(48));
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(60));
  expect(screen.queryByRole("button", { name: String(model.copy.loadMoreProducts) })).not.toBeInTheDocument();
});

it("preserves loaded products on a page failure and allows a successful retry", async () => {
  const normal = installCatalog();
  let failNext = true;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("offset=24") && failNext) {
        failNext = false;
        return Promise.reject(new Error("private network failure"));
      }
      return normal(input, init);
    }),
  );
  const user = userEvent.setup();
  render(<ShopperApp />);
  await screen.findByText("Catalog item 0");
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  expect(await screen.findByRole("alert")).toHaveTextContent(String(model.copy.loadError));
  expect(screen.getAllByTestId("product-card")).toHaveLength(24);
  await user.click(screen.getByRole("button", { name: model.copy.retry }));
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(48));
});

it("requests category pages from the API instead of filtering only the first page", async () => {
  const fetchMock = installCatalog();
  const user = userEvent.setup();
  render(<ShopperApp />);
  await screen.findByText("Catalog item 0");
  await user.click(screen.getByRole("button", { name: "Audio" }));
  const expected = catalog.filter((product) => product.category === "audio");
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(expected.length));
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("category=audio"))).toBe(true);
});

it("returns from search to the selected browse category and keeps subsequent pages consistent", async () => {
  installCatalog();
  const user = userEvent.setup();
  render(<ShopperApp />);
  await screen.findByText("Catalog item 0");
  await user.click(screen.getByRole("button", { name: "Audio" }));
  const audio = catalog.filter((product) => product.category === "audio");
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(audio.length));
  await user.type(screen.getByRole("searchbox"), "find a product");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  await screen.findByRole("heading", { name: model.copy.resultsTitle });
  await user.click(screen.getByRole("button", { name: model.copy.backToDiscover }));
  expect(screen.getByRole("button", { name: "Audio" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByTestId("product-card")).toHaveLength(audio.length);
  await user.click(screen.getByRole("button", { name: "All categories" }));
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(24));
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  await waitFor(() => expect(screen.getAllByTestId("product-card")).toHaveLength(48));
  const names = screen.getAllByTestId("product-card").map((card) => within(card).getByRole("heading").textContent);
  expect(new Set(names).size).toBe(48);
  expect(names).toEqual(catalog.slice(0, 48).map((product) => product.name));
});

it("restores a saved search result outside the first catalog page after reopening the app", async () => {
  installCatalog();
  const user = userEvent.setup();
  const first = render(<ShopperApp />);
  await screen.findByText("Catalog item 0");
  await user.type(screen.getByRole("searchbox"), "find a product");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  await user.click(await screen.findByRole("button", { name: `${model.copy.saveProduct}: Catalog item 59` }));
  first.unmount();
  render(<ShopperApp />);
  const navigation = await screen.findByRole("navigation");
  await user.click(within(navigation).getByRole("button", { name: /Saved list/ }));
  expect(await screen.findByRole("heading", { name: "Catalog item 59" })).toBeVisible();
});

it("keeps the current category when an obsolete page request completes later", async () => {
  const normal = installCatalog();
  const deferred = Promise.withResolvers<Response>();
  let pending = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("offset=24")) {
        pending = true;
        return deferred.promise;
      }
      return normal(input, init);
    }),
  );
  const user = userEvent.setup();
  render(<ShopperApp />);
  await screen.findByText("Catalog item 0");
  await user.click(screen.getByRole("button", { name: String(model.copy.loadMoreProducts) }));
  expect(pending).toBe(true);
  await user.click(screen.getByRole("button", { name: "Audio" }));
  await act(async () => deferred.resolve(jsonResponse(offerPage(catalog.slice(24, 48), { total: catalog.length }))));
  await waitFor(() =>
    expect(screen.getAllByTestId("product-card")).toHaveLength(
      catalog.filter((product) => product.category === "audio").length,
    ),
  );
});
