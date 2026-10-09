import type { Metadata } from "next";
import { AssistantPage } from "./assistant-page";

export const metadata: Metadata = {
  title: "Chat with the Aquifer Reach assistant | Ask about wells, pumps and estimates",
  description:
    "Ask the Aquifer Reach LLC assistant about water wells, pumps, permits and coverage in Northeast Florida — or send your free estimate request right in the chat.",
  alternates: { canonical: "/assistant" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <AssistantPage />;
}
