import { buildAmapMarkerUrl } from "../map";
import { sendPushPlusMessage } from "./pushplus";

export interface VehicleForNotification {
  plate_display: string;
  brand_model: string;
  color: string;
  pushplus_token: string | null;
}

export interface MoveNotificationInput {
  fetchImpl?: typeof fetch;
  externalUrl: string;
  vehicle: VehicleForNotification;
  locationText: string;
  latitude?: number;
  longitude?: number;
  message: string;
  requestCode: string;
  replyToken: string;
}

export async function sendMoveNotification(input: MoveNotificationInput) {
  if (!input.vehicle.pushplus_token) {
    return { ok: false, statusCode: 400, responseText: "missing pushplus token", shortCode: null };
  }
  const mapUrl =
    typeof input.latitude === "number" && typeof input.longitude === "number"
      ? buildAmapMarkerUrl(input.latitude, input.longitude, "挪车位置")
      : null;
  const content = [
    `### 有新的挪车请求`,
    ``,
    `- 车辆：${input.vehicle.plate_display}`,
    `- 车型：${input.vehicle.brand_model}`,
    `- 颜色：${input.vehicle.color}`,
    `- 位置：${input.locationText}`,
    mapUrl ? `- 地图：[打开高德地图](${mapUrl})` : null,
    `- 挪车留言：${input.message || "未填写"}`,
    `- 请求编号：${input.requestCode}`,
    ``,
    `[回复扫码人留言](${input.externalUrl}/r/${input.replyToken})`
  ]
    .filter(Boolean)
    .join("\n");

  return sendPushPlusMessage({
    fetchImpl: input.fetchImpl,
    token: input.vehicle.pushplus_token,
    title: "有新的挪车请求",
    content
  });
}
