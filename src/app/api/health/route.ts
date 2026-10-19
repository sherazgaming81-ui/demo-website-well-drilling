import { resolveAttempts } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const forwarding = Boolean(process.env.LEAD_WEBHOOK_URL?.trim());
  const attempts = resolveAttempts();
  return Response.json(
    {
      ok: true,
      leads: forwarding ? "webhook + memory" : "memory only",
      assistant: {
        // No scripted brain any more: without a key the chat answers 503, so say so here
        // instead of claiming a fallback that no longer exists.
        mode: attempts.length ? "live" : "unavailable",
        providers: [...new Set(attempts.map((attempt) => attempt.provider))],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
