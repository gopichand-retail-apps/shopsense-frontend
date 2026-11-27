"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { copy, type CatalogProduct, type PublicModel } from "@/lib/model";

export function ProductImage({ model, product }: { model: PublicModel; product: CatalogProduct }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="product-image-unavailable" role="img" aria-label={product.imageAlt}>
        <ImageOff size={28} aria-hidden="true" />
        <span>{copy(model, "imageUnavailable")}</span>
      </div>
    );
  return (
    <Image
      src={product.imageUrl}
      alt={product.imageAlt}
      fill
      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
      unoptimized
      className={product.imageCredit ? "reference-photo" : undefined}
      onError={() => setFailed(true)}
    />
  );
}

export function PhotoCredit({ model, product }: { model: PublicModel; product: CatalogProduct }) {
  if (!product.imageCredit) return null;
  return (
    <p className="photo-credit">
      <span>{copy(model, "styleReference")}</span>
      {" · "}
      <a href={product.imageCredit.source} target="_blank" rel="noopener noreferrer">
        {copy(model, "photoCredit").replace("{author}", product.imageCredit.author)}
      </a>
    </p>
  );
}
