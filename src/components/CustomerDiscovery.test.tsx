import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ShopperApp } from "./ShopperApp";
import { StoreGuide } from "./StoreGuide";
import { ComparisonDialog } from "./ComparisonDialog";
import { jsonResponse, model, pathnameOf, products, responseForPath } from "../../tests/shopper-fixtures";

it("submits the selected collection, color and budget to the API and clears them", async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<ShopperApp />);
  const query = await screen.findByRole("searchbox");
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: String(model.copy.locationLabel) })).toHaveValue("store-a"),
  );
  await user.selectOptions(screen.getByLabelText(String(model.copy.audienceFilter)), "men");
  await user.selectOptions(screen.getByLabelText(String(model.copy.colorFilter)), "black");
  await user.selectOptions(screen.getByLabelText(String(model.copy.budgetFilter)), "2500");
  await user.type(query, "shirt");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  await screen.findByRole("heading", { name: model.copy.resultsTitle });
  const request = fetchMock.mock.calls.find(([input]) => pathnameOf(input) === "/api/v2/search");
  expect(JSON.parse(String(request?.[1]?.body))).toEqual({
    query: "shirt",
    useAi: true,
    location: "store-a",
    filters: { audience: "men", color: "black", maximumPriceCents: 2500 },
  });
  await user.selectOptions(screen.getByLabelText(String(model.copy.audienceFilter)), "women");
  await user.selectOptions(screen.getByLabelText(String(model.copy.colorFilter)), "navy");
  await user.selectOptions(screen.getByLabelText(String(model.copy.budgetFilter)), "5000");
  await user.selectOptions(screen.getByLabelText(String(model.copy.budgetFilter)), "10000");
  await user.click(screen.getByRole("button", { name: String(model.copy.clearFilters) }));
  expect(screen.getByLabelText(String(model.copy.audienceFilter))).toHaveValue("");
  expect(screen.getByLabelText(String(model.copy.colorFilter))).toHaveValue("");
  expect(screen.getByLabelText(String(model.copy.budgetFilter))).toHaveValue("");
  expect(screen.queryByRole("button", { name: String(model.copy.clearFilters) })).not.toBeInTheDocument();
});

it("cancels a pending search and ignores its late result when the customer changes their mind", async () => {
  const pending = Promise.withResolvers<Response>();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (pathnameOf(input) === "/api/v2/search") {
        signal = init?.signal;
        return pending.promise;
      }
      return responseForPath(pathnameOf(input), init);
    }),
  );
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.type(await screen.findByRole("searchbox"), "a backpack");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  await user.click(screen.getByRole("button", { name: String(model.copy.cancelSearch) }));
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(responseForPath("/api/v2/search")));
  expect(screen.queryByRole("heading", { name: model.copy.resultsTitle })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: model.copy.searchAction })).toBeEnabled();
});

const layout = {
  id: "virtual-store",
  version: 1,
  name: "Virtual store",
  aisles: [{ id: "A2", label: "Men's clothing", category: "apparel", racks: ["Shirts"] }],
};

it("opens the store guide on demand and recovers from a request failure", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("private network detail"))
    .mockResolvedValue(jsonResponse({ data: layout }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<StoreGuide model={model} />);
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByText(String(model.copy.storeGuide)));
  expect(await screen.findByRole("alert")).toHaveTextContent(String(model.copy.storeGuideError));
  expect(screen.queryByText("private network detail")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: model.copy.retry }));
  expect(await screen.findByRole("heading", { name: "Men's clothing" })).toBeVisible();
  await user.click(screen.getByText(String(model.copy.storeGuide)));
  await user.click(screen.getByText(String(model.copy.storeGuide)));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("aborts an obsolete store guide request when closed", async () => {
  const pending = Promise.withResolvers<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => pending.promise),
  );
  const user = userEvent.setup();
  render(<StoreGuide model={model} />);
  const toggle = screen.getByText(String(model.copy.storeGuide));
  await user.click(toggle);
  await user.click(toggle);
  await act(async () => pending.reject(new Error("closed request")));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("recovers the store guide when reopened after a failed request", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue(jsonResponse({ data: layout })),
  );
  const user = userEvent.setup();
  render(<StoreGuide model={model} />);
  const toggle = screen.getByText(String(model.copy.storeGuide));
  await user.click(toggle);
  await screen.findByRole("alert");
  await user.click(toggle);
  await user.click(toggle);
  expect(await screen.findByRole("heading", { name: "Men's clothing" })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("focuses the comparison dialog, contains Tab and Shift+Tab, and restores the trigger", async () => {
  const user = userEvent.setup();
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const onClose = vi.fn();
  const dialog = render(<ComparisonDialog model={model} products={products.slice(0, 2)} onClose={onClose} />);
  const close = within(screen.getByRole("dialog")).getByRole("button", { name: model.copy.compareClose });
  expect(close).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  dialog.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

it("clearing the query aborts pending work without exposing its eventual network error", async () => {
  const pending = Promise.withResolvers<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      pathnameOf(input) === "/api/v2/search" ? pending.promise : responseForPath(pathnameOf(input), init),
    ),
  );
  const user = userEvent.setup();
  render(<ShopperApp />);
  await user.type(await screen.findByRole("searchbox"), "shirt");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  await user.click(screen.getByRole("button", { name: model.copy.clearSearch }));
  await act(async () => pending.reject(new Error("private canceled request")));
  await waitFor(() => expect(screen.getByRole("searchbox")).toHaveValue(""));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
