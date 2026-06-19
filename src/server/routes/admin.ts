import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { BuildAppOptions } from "../app";
import { requireUser } from "./auth";
import { hashPassword } from "../security";

const vehicleSchema = z.object({
  ownerId: z.number().int().positive().optional(),
  plateNumber: z.string().trim().min(2),
  plateDisplay: z.string().trim().min(2),
  brandModel: z.string().trim().min(1),
  color: z.string().trim().min(1),
  parkingHint: z.string().trim().default(""),
  ownerPhone: z.string().trim().nullable().optional(),
  pushplusToken: z.string().trim().nullable().optional(),
  allowPhoneCall: z.boolean().default(true),
  allowWechatNotify: z.boolean().default(true),
  status: z.enum(["active", "disabled"]).default("active")
});

function rowToVehicle(row: Record<string, unknown>, externalUrl: string) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    vehicleCode: row.vehicle_code,
    plateNumber: row.plate_number,
    plateDisplay: row.plate_display,
    brandModel: row.brand_model,
    color: row.color,
    parkingHint: row.parking_hint,
    ownerPhone: row.owner_phone,
    allowPhoneCall: row.allow_phone_call === 1,
    allowWechatNotify: row.allow_wechat_notify === 1,
    status: row.status,
    qrUrl: `${externalUrl}/c/${row.vehicle_code}`
  };
}

export async function registerAdminRoutes(app: FastifyInstance, options: BuildAppOptions): Promise<void> {
  app.get("/api/vehicles", async (request) => {
    const user = await requireUser(request, options);
    const rows =
      user.role === "admin"
        ? (options.db
            .prepare(
              `SELECT vehicles.*, users.name AS owner_name FROM vehicles
               JOIN users ON users.id = vehicles.owner_id
               ORDER BY vehicles.id DESC`
            )
            .all() as Array<Record<string, unknown>>)
        : (options.db
            .prepare("SELECT vehicles.*, NULL AS owner_name FROM vehicles WHERE owner_id = ? ORDER BY id DESC")
            .all(user.id) as Array<Record<string, unknown>>);
    return rows.map((row) => rowToVehicle(row, options.externalUrl));
  });

  app.post("/api/vehicles", async (request, reply) => {
    const user = await requireUser(request, options);
    const parsed = vehicleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "车辆信息不完整" });
    const ownerId = user.role === "admin" ? parsed.data.ownerId ?? user.id : user.id;
    const vehicleCode = nanoid(16);
    const result = options.db
      .prepare(
        `INSERT INTO vehicles (
          owner_id, vehicle_code, plate_number, plate_display, brand_model, color, parking_hint,
          owner_phone, pushplus_token, allow_phone_call, allow_wechat_notify, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ownerId,
        vehicleCode,
        parsed.data.plateNumber,
        parsed.data.plateDisplay,
        parsed.data.brandModel,
        parsed.data.color,
        parsed.data.parkingHint,
        parsed.data.ownerPhone ?? null,
        parsed.data.pushplusToken ?? null,
        parsed.data.allowPhoneCall ? 1 : 0,
        parsed.data.allowWechatNotify ? 1 : 0,
        parsed.data.status
      );
    return reply.code(201).send({ id: result.lastInsertRowid, vehicleCode });
  });

  app.put("/api/vehicles/:id", async (request, reply) => {
    const user = await requireUser(request, options);
    const { id } = request.params as { id: string };
    const parsed = vehicleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "车辆信息不完整" });
    const existing = options.db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as { owner_id: number } | undefined;
    if (!existing) return reply.code(404).send({ error: "车辆不存在" });
    if (user.role !== "admin" && existing.owner_id !== user.id) return reply.code(403).send({ error: "无权访问" });
    const current = options.db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as {
      plate_number: string;
      plate_display: string;
      brand_model: string;
      color: string;
      parking_hint: string;
      owner_phone: string | null;
      pushplus_token: string | null;
      allow_phone_call: number;
      allow_wechat_notify: number;
      status: "active" | "disabled";
    };
    options.db
      .prepare(
        `UPDATE vehicles SET plate_number = ?, plate_display = ?, brand_model = ?, color = ?, parking_hint = ?,
         owner_phone = ?, pushplus_token = ?, allow_phone_call = ?, allow_wechat_notify = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        parsed.data.plateNumber ?? current.plate_number,
        parsed.data.plateDisplay ?? current.plate_display,
        parsed.data.brandModel ?? current.brand_model,
        parsed.data.color ?? current.color,
        parsed.data.parkingHint ?? current.parking_hint,
        parsed.data.ownerPhone ?? current.owner_phone ?? null,
        parsed.data.pushplusToken ?? current.pushplus_token ?? null,
        typeof parsed.data.allowPhoneCall === "boolean" ? (parsed.data.allowPhoneCall ? 1 : 0) : current.allow_phone_call,
        typeof parsed.data.allowWechatNotify === "boolean"
          ? parsed.data.allowWechatNotify
            ? 1
            : 0
          : current.allow_wechat_notify,
        parsed.data.status ?? current.status,
        id
      );
    return { ok: true };
  });

  app.delete("/api/vehicles/:id", async (request, reply) => {
    const user = await requireUser(request, options);
    const { id } = request.params as { id: string };
    const existing = options.db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as { owner_id: number } | undefined;
    if (!existing) return reply.code(404).send({ error: "车辆不存在" });
    if (user.role !== "admin" && existing.owner_id !== user.id) return reply.code(403).send({ error: "无权访问" });
    options.db.prepare("DELETE FROM vehicles WHERE id = ?").run(id);
    return { ok: true };
  });

  app.get("/api/vehicles/:id/qr", async (request, reply) => {
    const user = await requireUser(request, options);
    const { id } = request.params as { id: string };
    const row = options.db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as
      | { owner_id: number; vehicle_code: string }
      | undefined;
    if (!row) return reply.code(404).send({ error: "车辆不存在" });
    if (user.role !== "admin" && row.owner_id !== user.id) return reply.code(403).send({ error: "无权访问" });
    const svg = await QRCode.toString(`${options.externalUrl}/c/${row.vehicle_code}`, { type: "svg" });
    return reply.header("content-type", "image/svg+xml").send(svg);
  });

  app.get("/api/move-requests", async (request) => {
    const user = await requireUser(request, options);
    const rows =
      user.role === "admin"
        ? options.db
            .prepare(
              `SELECT move_requests.*, vehicles.plate_display FROM move_requests
               JOIN vehicles ON vehicles.id = move_requests.vehicle_id
               ORDER BY move_requests.id DESC`
            )
            .all()
        : options.db
            .prepare(
              `SELECT move_requests.*, vehicles.plate_display FROM move_requests
               JOIN vehicles ON vehicles.id = move_requests.vehicle_id
               WHERE vehicles.owner_id = ?
               ORDER BY move_requests.id DESC`
            )
            .all(user.id);
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      requestCode: row.request_code,
      plateDisplay: row.plate_display,
      locationText: row.location_text,
      message: row.message,
      mapUrl: row.map_url,
      notifyChannel: row.notify_channel,
      notifyStatus: row.notify_status,
      createdAt: row.created_at
    }));
  });

  app.get("/api/admin/owners", async (request, reply) => {
    const user = await requireUser(request, options);
    if (user.role !== "admin") return reply.code(403).send({ error: "无权访问" });
    return options.db.prepare("SELECT id, role, name, phone, status FROM users ORDER BY id DESC").all();
  });

  app.post("/api/admin/owners", async (request, reply) => {
    const user = await requireUser(request, options);
    if (user.role !== "admin") return reply.code(403).send({ error: "无权访问" });
    const schema = z.object({ name: z.string().min(1), phone: z.string().nullable().optional(), password: z.string().min(10) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "车主信息不完整" });
    const result = options.db
      .prepare("INSERT INTO users (role, name, phone, password_hash) VALUES ('owner', ?, ?, ?)")
      .run(parsed.data.name, parsed.data.phone ?? null, await hashPassword(parsed.data.password));
    return reply.code(201).send({ id: result.lastInsertRowid });
  });
}
