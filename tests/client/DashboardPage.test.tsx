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

  it("lets an admin create owners and vehicles from forms", async () => {
    const createOwner = vi.fn().mockResolvedValue(undefined);
    const createVehicle = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardPageView
        user={{ id: 1, role: "admin", name: "管理员", phone: null }}
        owners={[{ id: 2, role: "owner", name: "车主A", phone: "13800138000", status: "active" }]}
        vehicles={[]}
        requests={[]}
        onCreateOwner={createOwner}
        onCreateVehicle={createVehicle}
        onUpdateVehicle={vi.fn()}
        onDeleteVehicle={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("车主姓名"), { target: { value: "车主B" } });
    fireEvent.change(screen.getByLabelText("车主手机号"), { target: { value: "13900139000" } });
    fireEvent.change(screen.getByLabelText("初始密码"), { target: { value: "OwnerPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "新增车主" }));

    await waitFor(() =>
      expect(createOwner).toHaveBeenCalledWith({
        name: "车主B",
        phone: "13900139000",
        password: "OwnerPass123"
      })
    );

    fireEvent.change(screen.getByLabelText("所属车主"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("车牌显示"), { target: { value: "粤B12345" } });
    fireEvent.change(screen.getByLabelText("车牌号码"), { target: { value: "粤B12345" } });
    fireEvent.change(screen.getByLabelText("车型"), { target: { value: "示例车型" } });
    fireEvent.change(screen.getByLabelText("颜色"), { target: { value: "灰色" } });
    fireEvent.change(screen.getByLabelText("车主电话"), { target: { value: "13800138000" } });
    fireEvent.change(screen.getByLabelText("PushPlus token"), { target: { value: "push-token" } });
    fireEvent.click(screen.getByRole("button", { name: "新增车辆" }));

    await waitFor(() =>
      expect(createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 2,
          plateDisplay: "粤B12345",
          plateNumber: "粤B12345",
          brandModel: "示例车型",
          color: "灰色",
          ownerPhone: "13800138000",
          pushplusToken: "push-token",
          allowPhoneCall: true,
          allowWechatNotify: true,
          status: "active"
        })
      )
    );
  });

  it("lets users edit and delete vehicles from the list", async () => {
    const updateVehicle = vi.fn().mockResolvedValue(undefined);
    const deleteVehicle = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardPageView
        user={{ id: 1, role: "owner", name: "张三", phone: null }}
        vehicles={[
          {
            id: 1,
            ownerId: 1,
            vehicleCode: "abc123",
            plateNumber: "粤B12345",
            plateDisplay: "粤B12345",
            brandModel: "示例车型",
            color: "灰色",
            parkingHint: "临时停靠",
            ownerPhone: "13800138000",
            allowPhoneCall: true,
            allowWechatNotify: true,
            status: "active",
            qrUrl: "https://car.example.com/c/abc123"
          }
        ]}
        requests={[]}
        onCreateOwner={vi.fn()}
        onCreateVehicle={vi.fn()}
        onUpdateVehicle={updateVehicle}
        onDeleteVehicle={deleteVehicle}
        onRefresh={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑 粤B12345" }));
    fireEvent.change(screen.getByLabelText("颜色"), { target: { value: "银灰色" } });
    fireEvent.click(screen.getByRole("button", { name: "保存车辆" }));

    await waitFor(() =>
      expect(updateVehicle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          color: "银灰色",
          plateDisplay: "粤B12345"
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "删除 粤B12345" }));

    await waitFor(() => expect(deleteVehicle).toHaveBeenCalledWith(1));
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
