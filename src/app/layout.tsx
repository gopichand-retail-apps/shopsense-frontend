import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/roboto/wght.css";
import "@fontsource-variable/roboto-slab/wght.css";
import model from "../../public/shopsense-ai-model.json";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${model.data.app.name} | ${model.data.app.descriptor}`,
    template: `%s | ${model.data.app.name}`,
  },
  description: model.data.app.description,
};

export default function RootLayout({ children }: { children: ReactNode; params: Promise<Record<string, string>> }) {
  return (
    <html lang={model.locale.split("-")[0]}>
      <body>{children}</body>
    </html>
  );
}
