import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ShopperApp } from "./ShopperApp";
import { jsonResponse, model, pathnameOf, responseForPath } from "../../tests/shopper-fixtures";

function installAiFetch(status: "assisted" | "unavailable", available = true) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathnameOf(input);
    if (path === "/api/v1/health") {
      return jsonResponse({
        data: {
          status: "ok",
          service: "shopsense-api",
          storage: "sqlite",
          ai: { available, provider: available ? "gemini" : "local" },
        },
      });
    }
    const response = responseForPath(path, init);
    if (path !== "/api/v2/search") return response;
    const payload = await response.json();
    payload.data.assistance = { status, provider: status === "assisted" ? "gemini" : "local" };
    return jsonResponse(payload);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("uses AI for an ordinary search without requiring a provider checkbox", async () => {
  const user = userEvent.setup();
  const fetchMock = installAiFetch("assisted");
  render(<ShopperApp />);
  await screen.findByText(String(model.copy.aiSearchReady));
  expect(screen.queryByRole("checkbox", { name: String(model.copy.aiSearchLabel) })).not.toBeInTheDocument();
  await user.click(screen.getByText(String(model.copy.searchPrivacy)));
  expect(screen.getByText(String(model.copy.aiSearchDisclosure))).toBeVisible();
  await user.type(screen.getByRole("searchbox"), "something for focused work");
  await user.click(screen.getByRole("button", { name: model.copy.searchAction }));
  expect(await screen.findByText(String(model.copy.aiSearchUsed))).toBeVisible();
  const searchCalls = fetchMock.mock.calls.filter(([input]) => pathnameOf(input) === "/api/v2/search");
  expect(JSON.parse(String(searchCalls[0][1]?.body))).toEqual({
    query: "something for focused work",
    useAi: true,
    location: "store-a",
  });
});

it("shows explicit recovery when the provider falls back to catalog search", async () => {
  const user = userEvent.setup();
  installAiFetch("unavailable");
  render(<ShopperApp />);
  await screen.findByText(String(model.copy.aiSearchReady));
  await user.click(screen.getByRole("button", { name: /a light pack/i }));
  expect(await screen.findByText(String(model.copy.aiSearchFallback))).toBeVisible();
});

it("keeps ordinary catalog search available when AI is unconfigured", async () => {
  const user = userEvent.setup();
  const fetchMock = installAiFetch("unavailable", false);
  render(<ShopperApp />);
  expect(await screen.findByText(String(model.copy.aiSearchUnavailable))).toBeVisible();
  await user.click(screen.getByRole("button", { name: /a light pack/i }));
  await screen.findByRole("heading", { name: model.copy.resultsTitle });
  const searchCalls = fetchMock.mock.calls.filter(([input]) => pathnameOf(input) === "/api/v2/search");
  expect(JSON.parse(String(searchCalls[0][1]?.body))).toHaveProperty("useAi", true);
  expect(screen.getByText(String(model.copy.aiSearchFallback))).toBeVisible();
});
