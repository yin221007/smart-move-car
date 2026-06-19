import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPageView } from "../../src/client/pages/DashboardPage";

describe("DashboardPageView", () => {
  it("shows vehicles and request history", () => {
    render(
      <DashboardPageView
        user={{ id: 1, role: "owner", name: "张三", phone: null }}
        vehicles={[
          {
            id: 1,
            ownerId: 1,
            vehicleCode: "abc123",
            plateNumber: "沪A12345",
            plateDisplay: "沪A·2345",
            brandModel: "特斯拉 Model Y",
            color: "白色",
            parkingHint: "地库 B2",
            ownerPhone: "13800138000",
            allowPhoneCall: true,
            allowWechatNotify: true,
            status: "active",
            qrUrl: "https://car.example.com/c/abc123"
          }
        ]}
        requests={[
          {
            id: 1,
            requestCode: "req1",
            plateDisplay: "沪A·2345",
            locationText: "地库 B2",
            message: "挡住出口",
            mapUrl: null,
            notifyChannel: "pushplus",
            notifyStatus: "sent",
            createdAt: "2026-06-19T10:00:00Z"
          }
        ]}
      />
    );

    expect(screen.getByText("车辆管理")).toBeInTheDocument();
    expect(screen.getAllByText("沪A·2345").length).toBeGreaterThan(0);
    expect(screen.getByText("请求记录")).toBeInTheDocument();
  });

  it("logs out with a POST request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" }
    });
    render(<DashboardPageView user={{ id: 1, role: "owner", name: "张三", phone: null }} vehicles={[]} requests={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "退出" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST"
        })
      )
    );
    expect(window.location.href).toBe("/login");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation
    });
  });
});
