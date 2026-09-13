export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { ok: true, storage: "in-memory" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
