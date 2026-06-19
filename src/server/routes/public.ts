import { nanoid } from "nanoid";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { BuildAppOptions } from "../app";
import { buildAmapMarkerUrl } from "../map";
import { sendMoveNotification } from "../notifications";
import { createRateLimiter } from "../rateLimit";
import { hashIp, maskPhone } from "../security";

const notifySchema = z.object({
  locationText: z.string().trim().min(1).max(200),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  message: z.string().trim().max(300).default(""),
  clientRequestId: z.string().trim().min(1).max(100)
});

const replySchema = z.object({
  reply: z.string().trim().min(1).max(120)
});

interface VehicleRow {
  id: number;
  vehicle_code: string;
  plate_display: string;
  brand_model: string;
  color: string;
  parking_hint: string;
  allow_phone_call: number;
  allow_wechat_notify: number;
  owner_phone: string | null;
  pushplus_token: string | null;
}

function chinaDateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function createDailyRequestCode(options: BuildAppOptions): string {
  const stamp = chinaDateStamp();
  const row = options.db
    .prepare("SELECT request_code FROM move_requests WHERE request_code LIKE ? ORDER BY request_code DESC LIMIT 1")
    .get(`${stamp}-%`) as { request_code: string } | undefined;
  const next = row ? Number(row.request_code.slice(`${stamp}-`.length)) + 1 : 1;
  return `${stamp}-${String(next).padStart(4, "0")}`;
}

function findPublicVehicle(options: BuildAppOptions, vehicleCode: string): VehicleRow | undefined {
  return options.db
    .prepare("SELECT * FROM vehicles WHERE vehicle_code = ? AND status = 'active'")
    .get(vehicleCode) as VehicleRow | undefined;
}

export async function registerPublicRoutes(app: FastifyInstance, options: BuildAppOptions): Promise<void> {
  app.get("/api/public/vehicles/:vehicleCode", async (request, reply) => {
    const { vehicleCode } = request.params as { vehicleCode: string };
    const vehicle = findPublicVehicle(options, vehicleCode);
    if (!vehicle) return reply.code(404).send({ error: "车辆不存在或已停用" });
    return {
      vehicleCode: vehicle.vehicle_code,
      plateDisplay: vehicle.plate_display,
      brandModel: vehicle.brand_model,
      color: vehicle.color,
      parkingHint: vehicle.parking_hint,
      allowPhoneCall: vehicle.allow_phone_call === 1,
      allowWechatNotify: vehicle.allow_wechat_notify === 1,
      maskedPhone: maskPhone(vehicle.owner_phone)
    };
  });

  app.post("/api/public/vehicles/:vehicleCode/notify", async (request, reply) => {
    const { vehicleCode } = request.params as { vehicleCode: string };
    const vehicle = findPublicVehicle(options, vehicleCode);
    if (!vehicle) return reply.code(404).send({ error: "车辆不存在或已停用" });
    if (vehicle.allow_wechat_notify !== 1) return reply.code(403).send({ error: "车辆未开启微信提醒" });

    const parsed = notifySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "请求内容不完整" });

    const limiter = createRateLimiter(options.db);
    if (!limiter.consume("vehicle", vehicle.vehicle_code, options.rateLimitSeconds)) {
      return reply.code(429).send({
        requestCode: "",
        status: "rate_limited",
        message: "提醒太频繁，请稍后再试或电话联系车主"
      });
    }

    const requestCode = createDailyRequestCode(options);
    const ownerReplyToken = nanoid(24);
    const mapUrl =
      typeof parsed.data.latitude === "number" && typeof parsed.data.longitude === "number"
        ? buildAmapMarkerUrl(parsed.data.latitude, parsed.data.longitude, "挪车位置")
        : null;
    const notification = await sendMoveNotification({
      fetchImpl: options.fetchImpl,
      externalUrl: options.externalUrl,
      vehicle,
      locationText: parsed.data.locationText,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      message: parsed.data.message,
      requestCode,
      replyToken: ownerReplyToken
    });
    const notifyStatus = notification.ok ? "sent" : "failed";
    options.db
      .prepare(
        `INSERT INTO move_requests (
          vehicle_id, request_code, owner_reply_token, location_text, latitude, longitude, map_url, message,
          ip_hash, user_agent, notify_channel, notify_status, notify_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pushplus', ?, ?)`
      )
      .run(
        vehicle.id,
        requestCode,
        ownerReplyToken,
        parsed.data.locationText,
        parsed.data.latitude ?? null,
        parsed.data.longitude ?? null,
        mapUrl,
        parsed.data.message,
        hashIp(request.ip, options.sessionSecret),
        request.headers["user-agent"] ?? null,
        notifyStatus,
        notification.responseText
      );

    return {
      requestCode,
      status: notifyStatus,
      message: notifyStatus === "sent" ? "已通知车主" : "通知发送失败，请尝试电话联系"
    };
  });

  app.get("/api/public/vehicles/:vehicleCode/phone", async (request, reply) => {
    const { vehicleCode } = request.params as { vehicleCode: string };
    const vehicle = findPublicVehicle(options, vehicleCode);
    if (!vehicle) return reply.code(404).send({ error: "车辆不存在或已停用" });
    if (vehicle.allow_phone_call !== 1) return reply.code(403).send({ error: "车辆未开启电话联系" });
    if (!vehicle.owner_phone) return reply.code(404).send({ error: "车主未配置电话" });
    return reply.redirect(`tel:${vehicle.owner_phone}`);
  });

  app.get("/api/public/requests/:requestCode", async (request, reply) => {
    const { requestCode } = request.params as { requestCode: string };
    const row = options.db
      .prepare("SELECT request_code, owner_reply, owner_replied_at FROM move_requests WHERE request_code = ?")
      .get(requestCode) as { request_code: string; owner_reply: string | null; owner_replied_at: string | null } | undefined;
    if (!row) return reply.code(404).send({ error: "请求不存在" });
    return {
      requestCode: row.request_code,
      ownerReply: row.owner_reply,
      ownerRepliedAt: row.owner_replied_at
    };
  });

  app.post("/api/public/replies/:replyToken", async (request, reply) => {
    const { replyToken } = request.params as { replyToken: string };
    const parsed = replySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "回复内容不能为空" });
    const result = options.db
      .prepare(
        "UPDATE move_requests SET owner_reply = ?, owner_replied_at = CURRENT_TIMESTAMP WHERE owner_reply_token = ? AND notify_status = 'sent'"
      )
      .run(parsed.data.reply, replyToken);
    if (result.changes === 0) return reply.code(404).send({ error: "请求不存在" });
    return { ok: true };
  });
}
