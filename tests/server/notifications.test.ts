import { describe, expect, it, vi } from "vitest";
import { buildAmapMarkerUrl } from "../../src/server/map";
import { createRateLimiter } from "../../src/server/rateLimit";
import { createDatabase } from "../../src/server/db";
import { sendPushPlusMessage } from "../../src/server/notifications/pushplus";

describe("rate limiter", () => {
  it("allows first request and blocks repeated request in the same window", () => {
    const db = createDatabase(":memory:");
    const limiter = createRateLimiter(db);

    expect(limiter.consume("vehicle", "abc", 60)).toBe(true);
    expect(limiter.consume("vehicle", "abc", 60)).toBe(false);
  });
});

describe("map links", () => {
  it("builds an Amap marker link", () => {
    expect(buildAmapMarkerUrl(31.2304, 121.4737, "挪车位置")).toContain("uri.amap.com/marker");
  });
});

describe("PushPlus adapter", () => {
  it("posts markdown content to PushPlus", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 200, msg: "请求成功", data: "abc" })
    });

    const result = await sendPushPlusMessage({
      fetchImpl: fetchMock,
      token: "push-token",
      title: "有新的挪车请求",
      content: "车辆：沪A12345"
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://www.pushplus.plus/send", expect.objectContaining({ method: "POST" }));
  });

  it("returns a failed result when PushPlus cannot be reached", async () => {
    const result = await sendPushPlusMessage({
      fetchImpl: vi.fn().mockRejectedValue(new Error("network down")),
      token: "push-token",
      title: "有新的挪车请求",
      content: "车辆：沪A12345"
    });

    expect(result).toMatchObject({
      ok: false,
      statusCode: 0,
      responseText: "network down"
    });
  });
});
