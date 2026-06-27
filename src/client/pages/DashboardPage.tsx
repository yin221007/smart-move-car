import { useEffect, useMemo, useState } from "react";
import type { DashboardUser, EntityStatus, MoveRequestSummary, OwnerInput, OwnerSummary, VehicleInput, VehicleSummary } from "../../shared/types";

interface DashboardPageViewProps {
  user: DashboardUser;
  owners?: OwnerSummary[];
  vehicles: VehicleSummary[];
  requests: MoveRequestSummary[];
  onCreateOwner?: (payload: OwnerInput) => Promise<void>;
  onCreateVehicle?: (payload: VehicleInput) => Promise<void>;
  onUpdateVehicle?: (id: number, payload: VehicleInput) => Promise<void>;
  onDeleteVehicle?: (id: number) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

interface VehicleFormState {
  ownerId: string;
  plateNumber: string;
  plateDisplay: string;
  brandModel: string;
  color: string;
  parkingHint: string;
  ownerPhone: string;
  pushplusToken: string;
  allowPhoneCall: boolean;
  allowWechatNotify: boolean;
  status: EntityStatus;
}

const emptyOwnerForm: OwnerInput = {
  name: "",
  phone: "",
  password: ""
};

function vehicleToForm(vehicle?: VehicleSummary, defaultOwnerId = ""): VehicleFormState {
  return {
    ownerId: vehicle ? String(vehicle.ownerId) : defaultOwnerId,
    plateNumber: vehicle?.plateNumber ?? "",
    plateDisplay: vehicle?.plateDisplay ?? "",
    brandModel: vehicle?.brandModel ?? "",
    color: vehicle?.color ?? "",
    parkingHint: vehicle?.parkingHint ?? "",
    ownerPhone: vehicle?.ownerPhone ?? "",
    pushplusToken: "",
    allowPhoneCall: vehicle?.allowPhoneCall ?? true,
    allowWechatNotify: vehicle?.allowWechatNotify ?? true,
    status: vehicle?.status ?? "active"
  };
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function DashboardPageView({
  user,
  owners = [],
  vehicles,
  requests,
  onCreateOwner,
  onCreateVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onRefresh
}: DashboardPageViewProps) {
  const defaultOwnerId = useMemo(() => {
    if (user.role === "admin") return owners[0] ? String(owners[0].id) : "";
    return String(user.id);
  }, [owners, user.id, user.role]);
  const [ownerForm, setOwnerForm] = useState<OwnerInput>(emptyOwnerForm);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(() => vehicleToForm(undefined, defaultOwnerId));
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    if (!editingVehicleId && !vehicleForm.ownerId && defaultOwnerId) {
      setVehicleForm((current) => ({ ...current, ownerId: defaultOwnerId }));
    }
  }, [defaultOwnerId, editingVehicleId, vehicleForm.ownerId]);

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.href = "/login";
  }

  async function submitOwner(event: React.FormEvent) {
    event.preventDefault();
    if (!onCreateOwner) return;
    setStatusText("");
    await onCreateOwner({
      name: ownerForm.name.trim(),
      phone: trimOrNull(ownerForm.phone ?? ""),
      password: ownerForm.password
    });
    setOwnerForm(emptyOwnerForm);
    setStatusText("车主已新增");
  }

  function buildVehiclePayload(): VehicleInput {
    const payload: VehicleInput = {
      plateNumber: vehicleForm.plateNumber.trim(),
      plateDisplay: vehicleForm.plateDisplay.trim(),
      brandModel: vehicleForm.brandModel.trim(),
      color: vehicleForm.color.trim(),
      parkingHint: vehicleForm.parkingHint.trim(),
      ownerPhone: trimOrNull(vehicleForm.ownerPhone),
      allowPhoneCall: vehicleForm.allowPhoneCall,
      allowWechatNotify: vehicleForm.allowWechatNotify,
      status: vehicleForm.status
    };
    if (user.role === "admin" && vehicleForm.ownerId) payload.ownerId = Number(vehicleForm.ownerId);
    const pushplusToken = vehicleForm.pushplusToken.trim();
    if (pushplusToken || editingVehicleId === null) payload.pushplusToken = pushplusToken || null;
    return payload;
  }

  async function submitVehicle(event: React.FormEvent) {
    event.preventDefault();
    setStatusText("");
    const payload = buildVehiclePayload();
    if (editingVehicleId) {
      await onUpdateVehicle?.(editingVehicleId, payload);
      setStatusText("车辆已保存");
    } else {
      await onCreateVehicle?.(payload);
      setStatusText("车辆已新增");
    }
    setEditingVehicleId(null);
    setVehicleForm(vehicleToForm(undefined, defaultOwnerId));
  }

  function editVehicle(vehicle: VehicleSummary) {
    setStatusText("");
    setEditingVehicleId(vehicle.id);
    setVehicleForm(vehicleToForm(vehicle, defaultOwnerId));
  }

  async function removeVehicle(vehicle: VehicleSummary) {
    setStatusText("");
    await onDeleteVehicle?.(vehicle.id);
    setStatusText("车辆已删除");
  }

  function cancelEdit() {
    setEditingVehicleId(null);
    setVehicleForm(vehicleToForm(undefined, defaultOwnerId));
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

      {statusText ? <p className="notice-text">{statusText}</p> : null}

      <section className="dashboard-grid">
        <div className="table-panel">
          <div className="panel-heading">
            <h2>车辆</h2>
            {onRefresh ? (
              <button className="text-button" type="button" onClick={() => void onRefresh()}>
                刷新
              </button>
            ) : null}
          </div>
          <div className="list-table">
            {vehicles.map((vehicle) => (
              <article className="vehicle-row" key={vehicle.id}>
                <div>
                  <strong>{vehicle.plateDisplay}</strong>
                  <span>
                    {vehicle.brandModel} · {vehicle.ownerName ?? user.name}
                  </span>
                </div>
                <div className="row-actions">
                  <span>{vehicle.color}</span>
                  <a href={`/api/vehicles/${vehicle.id}/qr`}>二维码</a>
                  <button className="text-button" type="button" aria-label={`编辑 ${vehicle.plateDisplay}`} onClick={() => editVehicle(vehicle)}>
                    编辑
                  </button>
                  <button className="danger-button" type="button" aria-label={`删除 ${vehicle.plateDisplay}`} onClick={() => void removeVehicle(vehicle)}>
                    删除
                  </button>
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

      <section className="dashboard-grid management-grid">
        {user.role === "admin" ? (
          <form className="table-panel form-panel" onSubmit={(event) => void submitOwner(event)}>
            <h2>新增车主</h2>
            <div className="form-grid">
              <label>
                车主姓名
                <input value={ownerForm.name} required onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} />
              </label>
              <label>
                车主手机号
                <input value={ownerForm.phone ?? ""} onChange={(event) => setOwnerForm({ ...ownerForm, phone: event.target.value })} />
              </label>
              <label>
                初始密码
                <input
                  type="password"
                  value={ownerForm.password}
                  minLength={10}
                  required
                  onChange={(event) => setOwnerForm({ ...ownerForm, password: event.target.value })}
                />
              </label>
            </div>
            <button className="primary-button" type="submit">
              新增车主
            </button>
          </form>
        ) : null}

        <form className="table-panel form-panel vehicle-form-panel" onSubmit={(event) => void submitVehicle(event)}>
          <div className="panel-heading">
            <h2>{editingVehicleId ? "编辑车辆" : "新增车辆"}</h2>
            {editingVehicleId ? (
              <button className="text-button" type="button" onClick={cancelEdit}>
                取消编辑
              </button>
            ) : null}
          </div>
          <div className="form-grid">
            {user.role === "admin" ? (
              <label>
                所属车主
                <select
                  value={vehicleForm.ownerId}
                  required
                  onChange={(event) => setVehicleForm({ ...vehicleForm, ownerId: event.target.value })}
                >
                  <option value="" disabled>
                    选择车主
                  </option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              车牌显示
              <input
                value={vehicleForm.plateDisplay}
                required
                onChange={(event) => setVehicleForm({ ...vehicleForm, plateDisplay: event.target.value })}
              />
            </label>
            <label>
              车牌号码
              <input
                value={vehicleForm.plateNumber}
                required
                onChange={(event) => setVehicleForm({ ...vehicleForm, plateNumber: event.target.value })}
              />
            </label>
            <label>
              车型
              <input
                value={vehicleForm.brandModel}
                required
                onChange={(event) => setVehicleForm({ ...vehicleForm, brandModel: event.target.value })}
              />
            </label>
            <label>
              颜色
              <input value={vehicleForm.color} required onChange={(event) => setVehicleForm({ ...vehicleForm, color: event.target.value })} />
            </label>
            <label>
              车主电话
              <input value={vehicleForm.ownerPhone} onChange={(event) => setVehicleForm({ ...vehicleForm, ownerPhone: event.target.value })} />
            </label>
            <label>
              PushPlus token
              <input
                value={vehicleForm.pushplusToken}
                placeholder={editingVehicleId ? "留空则保持原 token" : ""}
                onChange={(event) => setVehicleForm({ ...vehicleForm, pushplusToken: event.target.value })}
              />
            </label>
            <label>
              停车提示
              <input
                value={vehicleForm.parkingHint}
                placeholder="例如：临时停靠"
                onChange={(event) => setVehicleForm({ ...vehicleForm, parkingHint: event.target.value })}
              />
            </label>
            <label>
              状态
              <select
                value={vehicleForm.status}
                onChange={(event) => setVehicleForm({ ...vehicleForm, status: event.target.value as EntityStatus })}
              >
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
          </div>
          <div className="toggle-row">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={vehicleForm.allowPhoneCall}
                onChange={(event) => setVehicleForm({ ...vehicleForm, allowPhoneCall: event.target.checked })}
              />
              显示电话按钮
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={vehicleForm.allowWechatNotify}
                onChange={(event) => setVehicleForm({ ...vehicleForm, allowWechatNotify: event.target.checked })}
              />
              允许微信提醒
            </label>
          </div>
          <button className="primary-button" type="submit">
            {editingVehicleId ? "保存车辆" : "新增车辆"}
          </button>
        </form>
      </section>
    </main>
  );
}
