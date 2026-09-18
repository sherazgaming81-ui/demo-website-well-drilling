export const dynamic = "force-dynamic";

export async function GET() {
  const forwarding = Boolean(process.env.LEAD_WEBHOOK_URL?.trim());
  return Response.json(
    { ok: true, leads: forwarding ? "webhook + memory" : "memory only" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
