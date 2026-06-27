import type {
  DashboardUser,
  MoveRequestSummary,
  NotifyPayload,
  NotifyResult,
  OwnerInput,
  OwnerSummary,
  PublicVehicle,
  VehicleInput,
  VehicleSummary
} from "../shared/types";

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

export async function fetchCurrentUser(): Promise<DashboardUser> {
  const response = await fetch("/api/auth/me");
  if (!response.ok) throw new Error("未登录");
  return response.json() as Promise<DashboardUser>;
}

export async function fetchOwners(): Promise<OwnerSummary[]> {
  const response = await fetch("/api/admin/owners");
  if (!response.ok) throw new Error("无法读取车主列表");
  return response.json() as Promise<OwnerSummary[]>;
}

export async function createOwner(payload: OwnerInput): Promise<void> {
  const response = await fetch("/api/admin/owners", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("新增车主失败");
}

export async function createVehicle(payload: VehicleInput): Promise<void> {
  const response = await fetch("/api/vehicles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("新增车辆失败");
}

export async function updateVehicle(id: number, payload: VehicleInput): Promise<void> {
  const response = await fetch(`/api/vehicles/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("保存车辆失败");
}

export async function deleteVehicle(id: number): Promise<void> {
  const response = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("删除车辆失败");
}

export async function fetchMoveRequests(): Promise<MoveRequestSummary[]> {
  const response = await fetch("/api/move-requests");
  if (!response.ok) throw new Error("无法读取请求记录");
  return response.json() as Promise<MoveRequestSummary[]>;
}
