import { useEffect, useState } from "react";
import type { DashboardUser, MoveRequestSummary, OwnerInput, OwnerSummary, PublicVehicle, VehicleInput, VehicleSummary } from "../shared/types";
import {
  createOwner,
  createVehicle,
  deleteVehicle,
  fetchCurrentUser,
  fetchMoveRequests,
  fetchOwners,
  fetchPublicVehicle,
  fetchVehicles,
  notifyOwner,
  updateVehicle
} from "./api";
import { DashboardPageView } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OwnerReplyPage, ScanPageView } from "./pages/ScanPage";

export function App() {
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [vehicleError, setVehicleError] = useState("");
  const [dashboardUser, setDashboardUser] = useState<DashboardUser | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [requests, setRequests] = useState<MoveRequestSummary[]>([]);
  const path = window.location.pathname;
  const scanMatch = path.match(/^\/c\/([^/]+)$/);
  const replyMatch = path.match(/^\/r\/([^/]+)$/);
  const scanCode = scanMatch?.[1];

  async function loadDashboard() {
    setDashboardError("");
    const nextUser = await fetchCurrentUser();
    const [nextVehicles, nextRequests] = await Promise.all([fetchVehicles(), fetchMoveRequests()]);
    setDashboardUser(nextUser);
    setVehicles(nextVehicles);
    setRequests(nextRequests);
    if (nextUser.role === "admin") {
      setOwners(await fetchOwners());
    } else {
      setOwners([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (scanCode) {
      setVehicle(null);
      setVehicleError("");
      void fetchPublicVehicle(scanCode)
        .then((nextVehicle) => {
          if (!cancelled) setVehicle(nextVehicle);
        })
        .catch((error) => {
          if (!cancelled) setVehicleError(error instanceof Error ? error.message : "车辆不存在或已停用");
        });
      return () => {
        cancelled = true;
      };
    }
    if (path.startsWith("/dashboard")) {
      void loadDashboard().catch((error) => {
        if (cancelled) return;
        if (error instanceof Error && error.message === "未登录") {
          window.location.href = "/login";
          return;
        }
        setDashboardError(error instanceof Error ? error.message : "后台读取失败");
      });
    }
    return () => {
      cancelled = true;
    };
  }, [path, scanCode]);

  if (scanCode) {
    if (vehicleError) return <main className="page-state">{vehicleError}</main>;
    if (!vehicle) return <main className="page-state">正在读取车辆信息</main>;
    return <ScanPageView vehicle={vehicle} onNotify={(payload) => notifyOwner(scanCode, payload)} />;
  }
  if (replyMatch) return <OwnerReplyPage replyToken={replyMatch[1]} />;
  if (path.startsWith("/login")) return <LoginPage />;
  if (dashboardError) return <main className="page-state">{dashboardError}</main>;
  if (!dashboardUser) return <main className="page-state">正在读取后台</main>;
  return (
    <DashboardPageView
      user={dashboardUser}
      owners={owners}
      vehicles={vehicles}
      requests={requests}
      onCreateOwner={async (payload: OwnerInput) => {
        await createOwner(payload);
        await loadDashboard();
      }}
      onCreateVehicle={async (payload: VehicleInput) => {
        await createVehicle(payload);
        await loadDashboard();
      }}
      onUpdateVehicle={async (id: number, payload: VehicleInput) => {
        await updateVehicle(id, payload);
        await loadDashboard();
      }}
      onDeleteVehicle={async (id: number) => {
        await deleteVehicle(id);
        await loadDashboard();
      }}
      onRefresh={loadDashboard}
    />
  );
}
