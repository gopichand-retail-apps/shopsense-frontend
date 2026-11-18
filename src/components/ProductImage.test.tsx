import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { model, products } from "../../tests/shopper-fixtures";
import { PhotoCredit, ProductImage } from "./ProductImage";

it("replaces an unavailable product photograph with an accessible state", () => {
  render(<ProductImage model={model} product={products[0]} />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText(String(model.copy.imageUnavailable))).toBeVisible();
  expect(screen.getByRole("img")).toHaveAccessibleName(products[0].imageAlt);
});

it("credits reviewed reference photography and leaves ordinary product images uncredited", () => {
  const ordinary = render(<PhotoCredit model={model} product={products[0]} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  ordinary.unmount();
  const product = {
    ...products[0],
    imageCredit: {
      kind: "style-reference" as const,
      author: "Hanna Pad",
      source: "https://www.pexels.com/photo/a-black-shirt-hanging-on-the-wall-8532616/",
      licenseUrl: "https://www.pexels.com/license/" as const,
    },
  };
  render(
    <>
      <ProductImage model={model} product={product} />
      <PhotoCredit model={model} product={product} />
    </>,
  );
  expect(screen.getByRole("img")).toHaveClass("reference-photo");
  expect(screen.getByRole("link")).toHaveAttribute("href", product.imageCredit.source);
  expect(screen.getByText(String(model.copy.styleReference))).toBeVisible();
});
