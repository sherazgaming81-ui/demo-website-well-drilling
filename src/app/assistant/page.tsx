import type { Metadata } from "next";
import { AssistantPage } from "./assistant-page";

export const metadata: Metadata = {
  title: "Chat with the Freeze Point assistant | AC questions, Karachi",
  description:
    "Ask the Freeze Point AC Care assistant about cooling faults, gas leaks, servicing, inverter boards and new installations in Karachi — or send your free inspection request right in the chat.",
  alternates: { canonical: "/assistant" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <AssistantPage />;
}
