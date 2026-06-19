import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OwnerReplyPage, ScanPageView } from "../../src/client/pages/ScanPage";

describe("ScanPageView", () => {
  it("shows vehicle verification before actions", () => {
    render(
      <ScanPageView
        vehicle={{
          vehicleCode: "abc123",
          plateDisplay: "沪A·2345",
          brandModel: "特斯拉 Model Y",
          color: "白色",
          parkingHint: "地库 B2",
          allowPhoneCall: true,
          allowWechatNotify: true,
          maskedPhone: "138****8000"
        }}
        onNotify={async () => ({ requestCode: "req1", status: "sent", message: "已通知车主" })}
      />
    );

    expect(screen.getByText("沪A·2345")).toBeInTheDocument();
    expect(screen.getByText("特斯拉 Model Y")).toBeInTheDocument();
    expect(screen.getByText("微信提醒车主")).toBeInTheDocument();
    expect(screen.getByText("直接电话联系")).toBeInTheDocument();
    expect(screen.getByText("挪车留言")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "挡路了，请挪车" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "有急事，请挪车" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "紧急情况，请挪车" })).toBeInTheDocument();
  });

  it("fills a quick move message", () => {
    render(
      <ScanPageView
        vehicle={{
          vehicleCode: "abc123",
          plateDisplay: "沪A·2345",
          brandModel: "特斯拉 Model Y",
          color: "白色",
          parkingHint: "地库 B2",
          allowPhoneCall: true,
          allowWechatNotify: true,
          maskedPhone: "138****8000"
        }}
        onNotify={async () => ({ requestCode: "req1", status: "sent", message: "已通知车主" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "有急事，请挪车" }));

    expect(screen.getByLabelText("挪车留言")).toHaveValue("有急事，请挪车");
  });

  it("shows a delivered page after a successful notification", async () => {
    const onNotify = vi.fn().mockResolvedValue({ requestCode: "req1", status: "sent", message: "已通知车主" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ requestCode: "req1", ownerReply: null, ownerRepliedAt: null })
      })
    );
    render(
      <ScanPageView
        vehicle={{
          vehicleCode: "abc123",
          plateDisplay: "沪A·2345",
          brandModel: "特斯拉 Model Y",
          color: "白色",
          parkingHint: "地库 B2",
          allowPhoneCall: true,
          allowWechatNotify: true,
          maskedPhone: "138****8000"
        }}
        onNotify={onNotify}
      />
    );

    fireEvent.change(screen.getByLabelText("当前位置"), { target: { value: "地库 B2 出口" } });
    fireEvent.click(screen.getByRole("button", { name: "挡路了，请挪车" }));
    fireEvent.click(screen.getByRole("button", { name: "微信提醒车主" }));

    await waitFor(() => expect(screen.getByText("通知已送达")).toBeInTheDocument());
    expect(screen.getByText("车主已收到挪车请求，请在车旁稍候")).toBeInTheDocument();
  });

  it("lets the owner submit a reply from the notification link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<OwnerReplyPage replyToken="reply-token-1" />);

    fireEvent.click(screen.getByRole("button", { name: "马上下来" }));
    fireEvent.click(screen.getByRole("button", { name: "发送回复" }));

    await waitFor(() => expect(screen.getByText("回复已发送")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/replies/reply-token-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reply: "马上下来" })
      })
    );
  });
});
