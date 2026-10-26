import { headers } from "next/headers";

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { uploadTooLargeMessage } from "@/lib/video-upload";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("/api/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "owner" } } as never);
    vi.stubEnv("BACKEND_AUTH_SECRET", "secret");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("rejects a declared body over the cap before forwarding it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://app/api/upload", {
      method: "POST",
      headers: {
        "content-length": String(4_000_000_000 + 1024 * 1024 + 1),
        "content-type": "multipart/form-data; boundary=test",
      },
      body: "not-read",
    }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ detail: uploadTooLargeMessage(4_000_000_000) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams a multipart body when Content-Length is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ video_path: "upload://test.mp4" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://app/api/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("--test--"));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: string });
    const requestBody = request.body;

    const response = await POST(request);
    const forwardedRequest = fetchMock.mock.calls[0][1] as RequestInit & { duplex?: string };

    expect(response.status).toBe(201);
    expect(forwardedRequest.body).toBe(requestBody);
    expect(forwardedRequest.duplex).toBe("half");
    expect(new Headers(forwardedRequest.headers).get("content-type")).toBe(
      "multipart/form-data; boundary=test",
    );
  });
});
