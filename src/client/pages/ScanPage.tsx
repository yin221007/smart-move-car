import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { NotifyPayload, NotifyResult, PublicVehicle } from "../../shared/types";

interface ScanPageViewProps {
  vehicle: PublicVehicle;
  onNotify: (payload: NotifyPayload) => Promise<NotifyResult>;
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const quickMessages = ["挡路了，请挪车", "有急事，请挪车", "紧急情况，请挪车"];

export function ScanPageView({ vehicle, onNotify }: ScanPageViewProps) {
  const [locationText, setLocationText] = useState("");
  const [message, setMessage] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [result, setResult] = useState<string>("");
  const [deliveredRequestCode, setDeliveredRequestCode] = useState("");
  const [loading, setLoading] = useState(false);
  const canNotify = vehicle.allowWechatNotify && locationText.trim().length > 0;
  const phoneHref = useMemo(() => `/api/public/vehicles/${encodeURIComponent(vehicle.vehicleCode)}/phone`, [vehicle.vehicleCode]);

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setResult("当前浏览器无法定位，请手填位置");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationText((current) => current || "已获取当前位置");
      },
      () => setResult("定位未成功，请手填位置")
    );
  }

  async function submitNotify() {
    if (!canNotify) return;
    setLoading(true);
    setResult("");
    try {
      const response = await onNotify({
        locationText,
        latitude,
        longitude,
        message,
        clientRequestId: createRequestId()
      });
      if (response.status === "sent") {
        setDeliveredRequestCode(response.requestCode);
      } else {
        setResult(response.message);
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : "通知发送失败，请电话联系车主");
    } finally {
      setLoading(false);
    }
  }

  if (deliveredRequestCode) {
    return <DeliveredPage requestCode={deliveredRequestCode} />;
  }

  return (
    <main className="scan-shell">
      <section className="vehicle-panel" aria-labelledby="verify-title">
        <div className="plate-card">
          <p className="eyebrow">请核对车辆</p>
          <h1 id="verify-title">{vehicle.plateDisplay}</h1>
          <p className="vehicle-note">确认是这辆车影响通行后再联系车主</p>
        </div>
        <dl className="verify-grid">
          <div>
            <dt>车型</dt>
            <dd>{vehicle.brandModel}</dd>
          </div>
          <div>
            <dt>颜色</dt>
            <dd>{vehicle.color}</dd>
          </div>
          <div>
            <dt>位置提示</dt>
            <dd>{vehicle.parkingHint || "未填写"}</dd>
          </div>
        </dl>
      </section>

      <section className="action-panel" aria-label="联系车主">
        <div className="section-title">
          <p className="eyebrow">联系车主</p>
          <h2>留下位置和挪车留言</h2>
        </div>
        <label htmlFor="location-text">
          当前位置
          <textarea
            id="location-text"
            value={locationText}
            onChange={(event) => setLocationText(event.target.value)}
            placeholder="例如：地库 B2 电梯口、挡住出口"
            rows={3}
          />
        </label>
        <button className="secondary-button" type="button" onClick={useCurrentLocation}>
          获取当前位置
        </button>
        <label htmlFor="move-message">
          挪车留言
          <textarea
            id="move-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="请选择快捷留言或手动输入"
            rows={3}
          />
        </label>
        <div className="quick-message-row" role="group" aria-label="快捷留言">
          {quickMessages.map((quickMessage) => (
            <button className="quick-message" key={quickMessage} type="button" onClick={() => setMessage(quickMessage)}>
              {quickMessage}
            </button>
          ))}
        </div>
        <div className="action-row">
          {vehicle.allowWechatNotify ? (
            <button className="primary-button" type="button" disabled={!canNotify || loading} onClick={submitNotify}>
              {loading ? "正在提醒" : "微信提醒车主"}
            </button>
          ) : null}
          {vehicle.allowPhoneCall ? (
            <a className="phone-link" href={phoneHref}>
              直接电话联系
            </a>
          ) : null}
        </div>
        {vehicle.maskedPhone ? <p className="muted">电话尾号：{vehicle.maskedPhone}</p> : null}
        {result ? <p className="result-text">{result}</p> : null}
      </section>
    </main>
  );
}

interface ReplyStatus {
  requestCode: string;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
}

function DeliveredPage({ requestCode }: { requestCode: string }) {
  const [reply, setReply] = useState<ReplyStatus | null>(null);

  async function refreshReply() {
    try {
      const response = await fetch(`/api/public/requests/${encodeURIComponent(requestCode)}`);
      if (response.ok) {
        setReply((await response.json()) as ReplyStatus);
      }
    } catch {
      // The waiting page should stay calm if polling briefly fails.
    }
  }

  useEffect(() => {
    void refreshReply();
    const timer = window.setInterval(() => void refreshReply(), 5000);
    return () => window.clearInterval(timer);
  }, [requestCode]);

  return (
    <main className="delivered-shell">
      <section className="delivered-panel" aria-labelledby="delivered-title">
        <div className="delivered-icon" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">微信提醒</p>
        <h1 id="delivered-title">通知已送达</h1>
        <p className="delivered-copy">车主已收到挪车请求，请在车旁稍候</p>
        {reply?.ownerReply ? (
          <div className="owner-reply">
            <span>车主回复</span>
            <strong>{reply.ownerReply}</strong>
          </div>
        ) : (
          <p className="muted">如果车主回复留言，会自动显示在这里</p>
        )}
      </section>
    </main>
  );
}

export function OwnerReplyPage({ replyToken }: { replyToken: string }) {
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/public/replies/${encodeURIComponent(replyToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reply })
    });
    if (response.ok) {
      setSent(true);
    } else {
      setError("回复发送失败，请稍后再试");
    }
  }

  if (sent) {
    return (
      <main className="delivered-shell">
        <section className="delivered-panel compact" aria-labelledby="reply-sent-title">
          <div className="delivered-icon" aria-hidden="true">
            ✓
          </div>
          <h1 id="reply-sent-title">回复已发送</h1>
          <p className="delivered-copy">扫码人会在等候页面看到你的留言</p>
        </section>
      </main>
    );
  }

  return (
    <main className="reply-shell">
      <form className="reply-panel" onSubmit={submitReply}>
        <p className="eyebrow">车主回复</p>
        <h1>给扫码人留言</h1>
        <label htmlFor="owner-reply">
          回复内容
          <textarea
            id="owner-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="例如：马上下来，约 2 分钟"
            rows={4}
          />
        </label>
        <div className="quick-message-row" role="group" aria-label="快捷回复">
          {["马上下来", "2 分钟内到", "请先电话联系我"].map((quickReply) => (
            <button className="quick-message" key={quickReply} type="button" onClick={() => setReply(quickReply)}>
              {quickReply}
            </button>
          ))}
        </div>
        <button className="primary-button wide" type="submit" disabled={reply.trim().length === 0}>
          发送回复
        </button>
        {error ? <p className="result-text">{error}</p> : null}
      </form>
    </main>
  );
}
