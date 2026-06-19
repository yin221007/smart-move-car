import type { MoveRequestSummary, NotifyPayload, NotifyResult, PublicVehicle, VehicleSummary } from "../shared/types";

export async function fetchPublicVehicle(vehicleCode: string): Promise<PublicVehicle> {
  const response = await fetch(`/api/public/vehicles/${encodeURIComponent(vehicleCode)}`);
  if (!response.ok) throw new Error("车辆不存在或已停用");
  return response.json() as Promise<PublicVehicle>;
}

export async function notifyOwner(vehicleCode: string, payload: NotifyPayload): Promise<NotifyResult> {
  const response = await fetch(`/api/public/vehicles/${encodeURIComponent(vehicleCode)}/notify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = (await response.json()) as Partial<NotifyResult> & { error?: string };
  if (!response.ok) {
    throw new Error(result.message || result.error || "通知发送失败，请电话联系车主");
  }
  return result as NotifyResult;
}

export async function fetchVehicles(): Promise<VehicleSummary[]> {
  const response = await fetch("/api/vehicles");
  if (!response.ok) throw new Error("无法读取车辆列表");
  return response.json() as Promise<VehicleSummary[]>;
}

export async function fetchMoveRequests(): Promise<MoveRequestSummary[]> {
  const response = await fetch("/api/move-requests");
  if (!response.ok) throw new Error("无法读取请求记录");
  return response.json() as Promise<MoveRequestSummary[]>;
}
