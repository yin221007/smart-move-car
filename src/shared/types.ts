export type UserRole = "admin" | "owner";
export type EntityStatus = "active" | "disabled";
export type NotifyStatus = "pending" | "sent" | "failed" | "rate_limited";

export interface PublicVehicle {
  vehicleCode: string;
  plateDisplay: string;
  brandModel: string;
  color: string;
  parkingHint: string;
  allowPhoneCall: boolean;
  allowWechatNotify: boolean;
  maskedPhone: string | null;
}

export interface NotifyPayload {
  locationText: string;
  latitude?: number;
  longitude?: number;
  message: string;
  clientRequestId: string;
}

export interface NotifyResult {
  requestCode: string;
  status: NotifyStatus;
  message: string;
}

export interface DashboardUser {
  id: number;
  role: UserRole;
  name: string;
  phone: string | null;
}

export interface VehicleSummary {
  id: number;
  ownerId: number;
  ownerName?: string;
  vehicleCode: string;
  plateNumber: string;
  plateDisplay: string;
  brandModel: string;
  color: string;
  parkingHint: string;
  ownerPhone: string | null;
  allowPhoneCall: boolean;
  allowWechatNotify: boolean;
  status: EntityStatus;
  qrUrl: string;
}

export interface MoveRequestSummary {
  id: number;
  requestCode: string;
  plateDisplay: string;
  locationText: string;
  message: string;
  mapUrl: string | null;
  notifyChannel: string;
  notifyStatus: NotifyStatus;
  createdAt: string;
}
