import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBackendAuthHeaders } from "@/lib/backend-auth";
import { backendTraceHeaders } from "@/server/backend-api";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ action: string; part: string }> }) {
  const { action: uploadId, part } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || !/^\d+$/.test(part) || !request.body) {
    return NextResponse.json({ error: "Invalid upload part." }, { status: 400 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const requestHeaders = new Headers({
    ...buildBackendAuthHeaders(session.user.id),
    ...(await backendTraceHeaders()),
    "Content-Type": "application/octet-stream",
  });
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) requestHeaders.set("Content-Length", declaredLength);
  const response = await fetch(
    `${apiUrl.replace(/\/$/, "")}/upload/local/${uploadId}/parts/${part}`,
    {
      method: "PUT",
      headers: requestHeaders,
      body: request.body,
      duplex: "half",
      cache: "no-store",
    } as RequestInit,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
      ...(response.headers.get("x-trace-id") ? { "x-trace-id": response.headers.get("x-trace-id") as string } : {}),
    },
  });
}
