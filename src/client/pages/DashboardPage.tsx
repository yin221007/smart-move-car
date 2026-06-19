import type { DashboardUser, MoveRequestSummary, VehicleSummary } from "../../shared/types";

interface DashboardPageViewProps {
  user: DashboardUser;
  vehicles: VehicleSummary[];
  requests: MoveRequestSummary[];
}

export function DashboardPageView({ user, vehicles, requests }: DashboardPageViewProps) {
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.href = "/login";
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{user.role === "admin" ? "管理员" : "车主"}</p>
          <h1>车辆管理</h1>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          退出
        </button>
      </header>

      <section className="dashboard-grid">
        <div className="table-panel">
          <h2>车辆</h2>
          <div className="list-table">
            {vehicles.map((vehicle) => (
              <article className="vehicle-row" key={vehicle.id}>
                <div>
                  <strong>{vehicle.plateDisplay}</strong>
                  <span>{vehicle.brandModel}</span>
                </div>
                <div>
                  <span>{vehicle.color}</span>
                  <a href={`/api/vehicles/${vehicle.id}/qr`}>二维码</a>
                </div>
              </article>
            ))}
            {vehicles.length === 0 ? <p className="muted">还没有车辆</p> : null}
          </div>
        </div>

        <div className="table-panel">
          <h2>请求记录</h2>
          <div className="list-table">
            {requests.map((request) => (
              <article className="vehicle-row" key={request.id}>
                <div>
                  <strong>{request.plateDisplay}</strong>
                  <span>{request.locationText}</span>
                </div>
                <div>
                  <span>{request.notifyStatus}</span>
                  {request.mapUrl ? <a href={request.mapUrl}>地图</a> : null}
                </div>
              </article>
            ))}
            {requests.length === 0 ? <p className="muted">暂无挪车请求</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
