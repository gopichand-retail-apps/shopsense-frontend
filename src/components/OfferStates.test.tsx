import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import StaffPage, { metadata } from "@/app/staff/page";
import { copyWith } from "@/lib/model";
import { AvailabilityLine, CatalogFreshnessNotice } from "./OfferNotices";
import { ShopperApp } from "./ShopperApp";
import { StaffStatus } from "./StaffStatus";
import {
  envelope,
  freshness,
  jsonResponse,
  model,
  offerPage,
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
const serverError = () => jsonResponse({ error: { code: "INTERNAL_ERROR" } }, 500);

it("keeps browsing without stock claims when stores cannot be loaded", async () => {
  const withoutStore = offerProducts.map((product) => ({ ...product, availability: null }));
  const fetchMock = mockApi({
    "/api/v2/locations": serverError,
    "/api/v2/catalog": () => jsonResponse(offerPage(withoutStore)),
  });
  render(<ShopperApp />);

  expect(await screen.findByText(text("locationUnavailable"))).toBeVisible();
  await screen.findByRole("heading", { name: products[0].name });
  const catalogCall = fetchMock.mock.calls.find(([input]) => pathnameOf(input) === "/api/v2/catalog");
  expect(searchParamsOf(catalogCall![0]).has("location")).toBe(false);
  expect(screen.getByRole("checkbox", { name: text("availableOnlyFilter") })).toBeDisabled();
  expect(screen.getByText(text("availableOnlyNeedsStore"))).toBeVisible();
  expect(screen.queryAllByTestId("availability")).toHaveLength(0);
});

it("shows tag evidence as plain text because it has no stored attribute to open", async () => {
  const product = offerProducts[0];
  mockApi({
    "/api/v2/search": () =>
      jsonResponse({
        data: {
          ...offerSearch("pack").data,
          results: [{ product, matchedDetails: ["trail"], matches: [{ field: "tags", text: "trail" }] }],
        },
      }),
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.type(await screen.findByRole("searchbox"), "a light daypack");
  await user.click(screen.getByRole("button", { name: text("searchAction") }));

  const evidence = await screen.findByText("trail", { selector: "li" });
  expect(within(evidence).queryByRole("button")).not.toBeInTheDocument();
});

it("still opens the comparison with a clear notice when the refresh fails", async () => {
  mockApi({
    "/api/v2/catalog": (input) => (searchParamsOf(input).get("ids") ? serverError() : jsonResponse(offerPage())),
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.click(await screen.findByRole("button", { name: `${text("compare")}: ${products[0].name}` }));
  await user.click(screen.getByRole("button", { name: `${text("compare")}: ${products[1].name}` }));

  await user.click(screen.getAllByRole("button", { name: new RegExp(text("compareSelected")) })[0]!);

  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(await screen.findByText(model.copy.errors.server)).toBeInTheDocument();
});

it("explains a failed saved-item refresh after the store changes", async () => {
  window.localStorage.setItem(model.app.savedStorageKey, JSON.stringify([products[0].id]));
  let idLookups = 0;
  mockApi({
    "/api/v2/catalog": (input) => {
      if (!searchParamsOf(input).get("ids")) return jsonResponse(offerPage());
      idLookups += 1;
      return idLookups === 1 ? jsonResponse(offerPage(offerProducts.slice(0, 1))) : serverError();
    },
  });
  const user = userEvent.setup();
  render(<ShopperApp />);
  const store = await screen.findByRole("combobox", { name: text("locationLabel") });
  await waitFor(() => expect(store).toHaveValue("store-a"));

  await user.selectOptions(store, "store-b");

  expect(await screen.findByText(model.copy.errors.server)).toBeInTheDocument();
});

it("describes a stale catalog with no confirmed time and names an unknown store by its id", () => {
  render(
    <>
      <CatalogFreshnessNotice model={model} freshness={{ ...freshness, state: "stale", asOf: null }} />
      <AvailabilityLine
        model={model}
        availability={{ locationId: "store-z", state: "unknown", confirmedAt: null, stale: false }}
      />
    </>,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    copyWith(model, "catalogStaleDescription", { time: text("staffNever") }),
  );
  expect(screen.getByTestId("availability")).toHaveTextContent(
    copyWith(model, "availabilityUnknown", { store: "store-z" }),
  );
});

it("keeps the staff page out of search indexes and reports a missing content model", async () => {
  expect(metadata.title).toBe(envelope.messages.staffTitle);
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(StaffPage()).toMatchObject({ type: StaffStatus });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("missing", { status: 404 }))),
  );
  render(<StaffStatus />);

  expect(await screen.findByRole("alert")).toHaveTextContent("CONTENT_MODEL_UNAVAILABLE");
});
