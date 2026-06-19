import { useEffect, useState } from "react";
import type { MoveRequestSummary, PublicVehicle, VehicleSummary } from "../shared/types";
import { fetchMoveRequests, fetchPublicVehicle, fetchVehicles, notifyOwner } from "./api";
import { DashboardPageView } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OwnerReplyPage, ScanPageView } from "./pages/ScanPage";

export function App() {
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [vehicleError, setVehicleError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [requests, setRequests] = useState<MoveRequestSummary[]>([]);
  const path = window.location.pathname;
  const scanMatch = path.match(/^\/c\/([^/]+)$/);
  const replyMatch = path.match(/^\/r\/([^/]+)$/);
  const scanCode = scanMatch?.[1];

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
      void Promise.all([fetchVehicles(), fetchMoveRequests()]).then(([nextVehicles, nextRequests]) => {
        setVehicles(nextVehicles);
        setRequests(nextRequests);
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
  return <DashboardPageView user={{ id: 0, role: "owner", name: "车主", phone: null }} vehicles={vehicles} requests={requests} />;
}
