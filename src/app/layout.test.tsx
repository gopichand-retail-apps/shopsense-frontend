import { createElement } from "react";
import { describe, expect, it } from "vitest";
import Home from "./page";
import RootLayout, { metadata } from "./layout";
import { ShopperApp } from "@/components/ShopperApp";
import { envelope } from "../../tests/shopper-fixtures";

describe("Next.js app shell", () => {
  it("uses content-model metadata and language at the document boundary", () => {
    const root = RootLayout({
      params: Promise.resolve({}),
      children: createElement("span", null, "content"),
    });

    expect(metadata.description).toBe(envelope.data.app.description);
    expect(root).toMatchObject({
      type: "html",
      props: { lang: "en" },
    });
  });

  it("routes the home page to the shopper application", () => {
    expect(Home()).toMatchObject({ type: ShopperApp });
  });
});
