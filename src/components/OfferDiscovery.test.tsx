import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { copyWith, formatDateTime } from "@/lib/model";
import { ShopperApp } from "./ShopperApp";
import {
  freshness,
  inStock,
  jsonResponse,
  model,
  offerPage,
  offerProduct,
  offerProducts,
  offerSearch,
  pathnameOf,
  products,
  responseForPath,
  searchParamsOf,
} from "../../tests/shopper-fixtures";

type Handler = (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>;

function mockApi(overrides: Record<string, Handler> = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathnameOf(input);
    return overrides[path]?.(input, init) ?? responseForPath(path, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const text = (key: string) => String(model.copy[key]);
const calls = (fetchMock: ReturnType<typeof mockApi>, path: string) =>
  fetchMock.mock.calls.filter(([input]) => pathnameOf(input) === path);
const searchBodies = (fetchMock: ReturnType<typeof mockApi>) =>
  calls(fetchMock, "/api/v2/search").map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
const cardFor = (name: string) =>
  screen.getAllByTestId("product-card").find((card) => within(card).queryByRole("heading", { name }))!;

const staleAt = "2026-11-22T09:00:00.000Z";
const mixedStock = [
  offerProduct(products[0], inStock),
  offerProduct(products[1], { locationId: "store-a", state: "unknown", confirmedAt: staleAt, stale: true }),
  offerProduct(products[2], { locationId: "store-a", state: "unknown", confirmedAt: null, stale: false }),
  offerProduct(products[3], { ...inStock, state: "out_of_stock" }),
];

it("anchors discovery on the first store and shows only confirmed stock as in stock", async () => {
  const fetchMock = mockApi({ "/api/v2/catalog": () => jsonResponse(offerPage(mixedStock)) });
  render(<ShopperApp />);

  const store = await screen.findByRole("combobox", { name: text("locationLabel") });
  await waitFor(() => expect(store).toHaveValue("store-a"));
  await screen.findByRole("heading", { name: products[0].name });
  expect(searchParamsOf(calls(fetchMock, "/api/v2/catalog")[0]![0]).get("location")).toBe("store-a");
  expect(cardFor(products[0].name)).toHaveTextContent(
    copyWith(model, "availabilityInStock", { store: "Northside Store" }),
  );
  expect(cardFor(products[1].name)).toHaveTextContent(
    copyWith(model, "availabilityStale", { store: "Northside Store", time: formatDateTime(model, staleAt) }),
  );
  expect(cardFor(products[2].name)).toHaveTextContent(
    copyWith(model, "availabilityUnknown", { store: "Northside Store" }),
  );
  expect(cardFor(products[3].name)).toHaveTextContent(
    copyWith(model, "availabilityOutOfStock", { store: "Northside Store" }),
  );
  for (const name of [products[1].name, products[2].name, products[3].name])
    expect(cardFor(name)).not.toHaveTextContent(copyWith(model, "availabilityInStock", { store: "Northside Store" }));
  expect(
    screen.getByText(copyWith(model, "catalogFreshness", { time: formatDateTime(model, freshness.asOf!) })),
  ).toBeVisible();
});

it("sends the store and in-stock filter with a search and follows a store change", async () => {
  const fetchMock = mockApi();
  const user = userEvent.setup();
  render(<ShopperApp />);
  const store = await screen.findByRole("combobox", { name: text("locationLabel") });
  await waitFor(() => expect(store).toHaveValue("store-a"));

  await user.click(screen.getByRole("checkbox", { name: text("availableOnlyFilter") }));
  await user.type(screen.getByRole("searchbox"), "a light daypack");
  await user.click(screen.getByRole("button", { name: text("searchAction") }));
  await screen.findByRole("heading", { name: text("resultsTitle") });
  expect(searchBodies(fetchMock).at(-1)).toEqual({
    query: "a light daypack",
    useAi: true,
    location: "store-a",
    filters: { availableOnly: true },
  });

  await user.selectOptions(store, "store-b");
  await waitFor(() => expect(searchBodies(fetchMock).at(-1)?.location).toBe("store-b"));
  expect(
    calls(fetchMock, "/api/v2/catalog").some(([input]) => searchParamsOf(input).get("location") === "store-b"),
  ).toBe(true);

  await user.selectOptions(store, "");
  const inStockOnly = screen.getByRole("checkbox", { name: text("availableOnlyFilter") });
  expect(inStockOnly).toBeDisabled();
  expect(inStockOnly).not.toBeChecked();
  await waitFor(() => expect(searchBodies(fetchMock).at(-1)).toEqual({ query: "a light daypack", useAi: true }));
});

it("offers to include unconfirmed items when nothing matching is in stock", async () => {
  const fetchMock = mockApi({
    "/api/v2/search": (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { filters?: { availableOnly?: boolean } };
      return jsonResponse(offerSearch("pack", body.filters?.availableOnly ? [] : offerProducts.slice(0, 1)));
    },
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: text("locationLabel") })).toHaveValue("store-a"));
  await user.click(screen.getByRole("checkbox", { name: text("availableOnlyFilter") }));
  await user.type(screen.getByRole("searchbox"), "a light daypack");
  await user.click(screen.getByRole("button", { name: text("searchAction") }));

  expect(
    await screen.findByText(copyWith(model, "noMatchesInStockDescription", { store: "Northside Store" })),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: text("includeUnconfirmed") }));

  await screen.findByRole("heading", { name: products[0].name });
  expect(searchBodies(fetchMock).at(-1)).toEqual({ query: "a light daypack", useAi: true, location: "store-a" });
  expect(screen.getByRole("checkbox", { name: text("availableOnlyFilter") })).not.toBeChecked();
});

it("shows shoppers an honest empty store when nothing is published", async () => {
  const empty = { ...freshness, state: "empty", asOf: null };
  mockApi({
    "/api/v2/catalog": () => jsonResponse(offerPage([], { catalog: empty })),
    "/api/v2/search": () => jsonResponse(offerSearch("pack", [], { catalog: empty })),
  });
  const user = userEvent.setup();
  render(<ShopperApp />);

  expect(await screen.findByRole("heading", { name: text("catalogEmptyTitle") })).toBeVisible();
  await user.type(screen.getByRole("searchbox"), "a light daypack");
  await user.click(screen.getByRole("button", { name: text("searchAction") }));
  expect(await screen.findByRole("heading", { name: text("catalogEmptyTitle") })).toBeVisible();
  expect(screen.queryByText(text("noMatchesTitle"))).not.toBeInTheDocument();
});

it("warns shoppers when store information is out of date", async () => {
  const stale = { ...freshness, state: "stale", asOf: staleAt };
  mockApi({ "/api/v2/catalog": () => jsonResponse(offerPage(mixedStock.slice(1, 2), { catalog: stale })) });
  render(<ShopperApp />);

  const notice = await screen.findByRole("status", { name: text("catalogStaleTitle") });
  expect(notice).toHaveTextContent(
    copyWith(model, "catalogStaleDescription", { time: formatDateTime(model, staleAt) }),
  );
});

it("links a matched detail to the stored attribute it came from", async () => {
  const product = offerProducts[0];
  mockApi({
    "/api/v2/search": () =>
      jsonResponse({
        data: {
          ...offerSearch("pack").data,
          results: [
            {
              product,
              matchedDetails: [product.attributes[1]],
              matches: [{ field: "attributes", index: 1, text: product.attributes[1] }],
            },
          ],
        },
      }),
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.type(await screen.findByRole("searchbox"), "a light daypack");
  await user.click(screen.getByRole("button", { name: text("searchAction") }));

  await user.click(
    await screen.findByRole("button", {
      name: copyWith(model, "showStoredAttribute", { text: product.attributes[1] }),
    }),
  );

  const attribute = screen.getByText(product.attributes[1], { selector: "li" });
  expect(attribute.closest("details")).toHaveAttribute("open");
  expect(attribute).toHaveFocus();
});

it("reports saved items the store no longer publishes and lets the shopper remove them", async () => {
  window.localStorage.setItem(model.app.savedStorageKey, JSON.stringify([products[0].id, "gone-1"]));
  mockApi({
    "/api/v2/catalog": (input) => {
      const ids = searchParamsOf(input).get("ids");
      return jsonResponse(ids ? offerPage(offerProducts.slice(0, 1), { unavailableIds: ["gone-1"] }) : offerPage());
    },
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  const navigation = await screen.findByRole("navigation", { name: text("primaryNavigation") });
  await user.click(within(navigation).getByRole("button", { name: /Saved list/ }));

  expect(await screen.findByText(copyWith(model, "savedUnavailableNotice", { count: 1 }))).toBeVisible();
  await user.click(screen.getByRole("button", { name: text("savedUnavailableRemove") }));

  await waitFor(() =>
    expect(JSON.parse(window.localStorage.getItem(model.app.savedStorageKey) ?? "[]")).toEqual([products[0].id]),
  );
  expect(screen.queryByText(copyWith(model, "savedUnavailableNotice", { count: 1 }))).not.toBeInTheDocument();
});

it("refreshes compared items before opening the comparison and drops withdrawn ones", async () => {
  mockApi({
    "/api/v2/catalog": (input) =>
      searchParamsOf(input).get("ids")
        ? jsonResponse(offerPage(offerProducts.slice(0, 1), { unavailableIds: [products[1].id] }))
        : jsonResponse(offerPage()),
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.click(await screen.findByRole("button", { name: `${text("compare")}: ${products[0].name}` }));
  await user.click(screen.getByRole("button", { name: `${text("compare")}: ${products[1].name}` }));

  await user.click(screen.getAllByRole("button", { name: new RegExp(text("compareSelected")) })[0]!);

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: products[0].name })).toBeVisible();
  expect(within(dialog).queryByRole("heading", { name: products[1].name })).not.toBeInTheDocument();
  expect(within(dialog).getByText(text("compareAvailability"))).toBeVisible();
  expect(await screen.findByText(text("compareRefreshed"))).toBeInTheDocument();
});
