import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { copyWith, formatDateTime } from "@/lib/model";
import { StaffStatus } from "./StaffStatus";
import { freshness, jsonResponse, model, pathnameOf, responseForPath } from "../../tests/shopper-fixtures";

const text = (key: string) => String(model.copy[key]);
const status = (overrides: Record<string, unknown> = {}) =>
  jsonResponse({ data: { ...freshness, offerCount: 12, withdrawnCount: 1, locationCount: 2, ...overrides } });

function mockStatus(...responses: (() => Response)[]) {
  let call = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const path = pathnameOf(input);
    if (path !== "/api/v2/feed-status") return responseForPath(path);
    const next = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("shows staff the catalog onboarding when nothing is published", async () => {
  mockStatus(() => status({ state: "empty", asOf: null, offerCount: 0, withdrawnCount: 0 }));
  render(<StaffStatus />);

  expect(await screen.findByRole("heading", { name: text("staffOnboardingTitle") })).toBeVisible();
  expect(screen.getByText(text("staffOnboardingDescription"))).toBeVisible();
  expect(screen.getByText(text("staffLocalNotice"))).toBeVisible();
  expect(screen.getByRole("definition", { name: text("staffLastUpdate") })).toHaveTextContent(text("staffNever"));
});

it("summarises a connected catalog with counts and freshness", async () => {
  mockStatus(() => status());
  render(<StaffStatus />);

  expect(await screen.findByRole("heading", { name: text("staffReadyTitle") })).toBeVisible();
  expect(screen.getByRole("definition", { name: text("staffOfferCount") })).toHaveTextContent("12");
  expect(screen.getByRole("definition", { name: text("staffWithdrawnCount") })).toHaveTextContent("1");
  expect(screen.getByRole("definition", { name: text("staffLocationCount") })).toHaveTextContent("2");
  expect(screen.getByRole("definition", { name: text("staffLastUpdate") })).toHaveTextContent(
    formatDateTime(model, freshness.asOf!),
  );
  expect(screen.getByText(copyWith(model, "staffFreshnessLimit", { minutes: 1440 }))).toBeVisible();
  expect(screen.getByRole("link", { name: text("staffBack") })).toHaveAttribute("href", "/");
});

it("flags a stale feed", async () => {
  mockStatus(() => status({ state: "stale" }));
  render(<StaffStatus />);

  expect(await screen.findByRole("heading", { name: text("staffStaleTitle") })).toBeVisible();
});

it("recovers from a status failure with a retry", async () => {
  mockStatus(
    () => jsonResponse({ error: { code: "INTERNAL_ERROR" } }, 500),
    () => status(),
  );
  const user = userEvent.setup();
  render(<StaffStatus />);

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(text("staffLoadError"));
  await user.click(within(alert).getByRole("button", { name: text("retry") }));

  expect(await screen.findByRole("heading", { name: text("staffReadyTitle") })).toBeVisible();
});
