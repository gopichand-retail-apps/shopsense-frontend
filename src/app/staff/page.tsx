import type { Metadata } from "next";
import model from "../../../public/shopsense-ai-model.json";
import { StaffStatus } from "@/components/StaffStatus";

export const metadata: Metadata = {
  title: model.messages.staffTitle,
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return <StaffStatus />;
}
