import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildBackendAuthHeaders } from "@/lib/backend-auth";
import { backendTraceHeaders } from "@/server/backend-api";
import { maxVideoUploadBytes, uploadTooLargeMessage } from "@/lib/video-upload";

// Same slack the API allows for multipart boundaries around a file on the cap.
const UPLOAD_FRAMING_BYTES = 1024 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Keep the proxy streaming. Calling request.formData() here buffers a
  // multi-gigabyte upload in the frontend container before forwarding it.
  const declaredLength = request.headers.get("content-length");
  const limit = maxVideoUploadBytes();
  if (declaredLength && !/^\d+$/.test(declaredLength)) {
    return NextResponse.json({ detail: "Invalid Content-Length." }, { status: 400 });
  }
  if (declaredLength && Number(declaredLength) > limit + UPLOAD_FRAMING_BYTES) {
    return NextResponse.json({ detail: uploadTooLargeMessage(limit) }, { status: 413 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return NextResponse.json({ detail: "A multipart upload is required." }, { status: 400 });
  }
  if (!request.body) {
    return NextResponse.json({ detail: "A video file is required." }, { status: 400 });
  }

  const apiUrl =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000";
  const normalizedApiUrl = apiUrl.replace(/\/$/, "");
  const requestHeaders = new Headers({
    ...buildBackendAuthHeaders(session.user.id),
    ...(await backendTraceHeaders()),
    "Content-Type": contentType,
  });
  if (declaredLength) requestHeaders.set("Content-Length", declaredLength);

  const upstream = await fetch(`${normalizedApiUrl}/upload`, {
    method: "POST",
    headers: requestHeaders,
    body: request.body,
    duplex: "half",
    cache: "no-store",
  } as RequestInit);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      ...(upstream.headers.get("x-trace-id")
        ? { "x-trace-id": upstream.headers.get("x-trace-id") as string }
        : {}),
    },
  });
}
