# 扫码挪车系统设计

日期：2026-06-19

## 目标

构建一个可部署在群晖 NAS 上的扫码挪车系统。扫码人通过二维码进入车辆专属页面，先核对车牌和车辆信息，再选择微信提醒车主或直接电话联系车主。系统支持多车主、多车辆、后台管理、请求记录和基础限流。

## 已确认方案

- 公网入口采用 Cloudflare Tunnel。
- 群晖本地不开放 443 入站端口。
- 所有二维码和推送消息链接都使用标准 HTTPS 域名，例如 `https://car.example.com/c/{vehicleCode}`。
- 微信提醒主通道采用 PushPlus。
- 通知通道预留 WxPusher、Server 酱、短信、语音等扩展点。
- 扫码页提供两种联系入口：微信提醒车主、直接电话联系车主。
- 扫码后必须先显示车辆核对信息，包括车牌、车型、颜色和停车提示。
- 系统支持后续多车主、多车辆使用。
- 群晖部署采用 Docker Compose。
- MVP 数据库采用 SQLite，通过群晖目录持久化。

## 参考项目和资料

- `oozzbb/car-qrcode-notify`：参考扫码页上的通知和电话双入口、多车辆管理、服务端处理通知和手机号。
- `lishewen/MoveCar`：参考 PushPlus/Bark 通知、多用户、Docker Compose、位置分享、限流。
- PushPlus 官方文档：参考消息接口、微信推送、webhook、短信和语音通道能力。
- Cloudflare Tunnel 官方文档：参考 outbound-only 隧道模式，不要求源站有公网 IP 或开放入站端口。

## 总体架构

系统由两个容器和一个持久化目录组成：

- `app`：Web 前端、扫码页、后台页面、API、通知发送、二维码生成。
- `cloudflared`：Cloudflare Tunnel 客户端，把公网 HTTPS 域名转发到群晖内网 `app` 容器。
- `data`：SQLite 数据库、日志和上传/导出的二维码文件。

外部访问路径：

```text
微信扫码
  -> https://car.example.com/c/{vehicleCode}
  -> Cloudflare Tunnel
  -> 群晖 Docker 网络
  -> app 容器
```

应用内部只依赖 `EXTERNAL_URL` 生成链接，不绑定 Cloudflare。将来若改为 VPS + frp 或其他入口，业务代码不需要重写。

## 用户角色

### 管理员

- 创建、禁用、重置车主账号。
- 查看所有车辆和所有挪车请求。
- 配置系统级参数，例如站点域名、默认限流、通知通道开关。

### 车主

- 管理自己的车辆。
- 配置每辆车的车牌、车型、颜色、手机号、PushPlus token、通知开关。
- 下载或查看车辆二维码。
- 查看自己的挪车请求记录。

### 扫码人

- 不需要登录。
- 扫码后核对车辆信息。
- 选择微信提醒或电话联系。
- 微信提醒时可提交当前位置和备注。

## 扫码页流程

1. 扫码人访问 `/c/{vehicleCode}`。
2. 系统根据 `vehicleCode` 查询车辆。
3. 若车辆不存在、禁用或二维码已失效，显示明确的不可用页面。
4. 若车辆可用，显示车辆核对信息：
   - 车牌号或车牌尾号
   - 车辆品牌/车型
   - 车身颜色
   - 停车提示语
5. 扫码人确认车辆后，页面显示两个操作：
   - 微信提醒车主
   - 直接电话联系车主
6. 如果车辆关闭电话联系，不显示电话按钮。
7. 如果车辆关闭微信提醒，不显示微信提醒按钮。

## 微信提醒流程

1. 扫码人点击微信提醒。
2. 页面请求浏览器定位权限。
3. 定位成功时记录经纬度，并生成高德地图链接。
4. 定位失败或用户拒绝时，允许手填位置描述。
5. 扫码人可填写备注，例如“挡住出口”“地库 B2 靠近电梯口”。
6. 前端提交车辆码、位置、备注和一次性请求标识。
7. 后端校验车辆状态、通知开关和限流。
8. 后端创建挪车请求记录。
9. 后端调用 PushPlus 发送微信通知。
10. 后端保存 PushPlus 同步响应和发送状态。
11. 前端显示提交结果。

推送内容包含：

- 标题：有新的挪车请求
- 车辆信息：车牌、车型、颜色
- 位置：地图链接或手填位置
- 备注
- 请求时间
- 请求编号

## 电话联系流程

电话联系是车辆级开关。若开启，扫码页显示拨号按钮。MVP 采用浏览器 `tel:` 链接直接唤起拨号：

```text
tel:{ownerPhone}
```

这样实现简单、稳定，不依赖第三方通话服务。缺点是扫码人会看到手机号。后续如果要增强隐私，可接入中间号、隐私号或语音通知服务。

## 位置和地图

扫码页应支持两类位置输入：

- 自动定位：浏览器 Geolocation 获取 WGS84 坐标。
- 手动描述：扫码人输入文字位置。

后端保存原始坐标和位置描述。面向中国大陆使用时，通知内容优先生成高德地图链接。涉及位置服务、路线、距离、POI 或天气等中国地理能力时，优先使用已配置的 Amap MCP/API 作为数据来源，且不得泄露 Amap API key。

## 数据模型

### users

- `id`
- `role`：`admin` 或 `owner`
- `name`
- `phone`
- `passwordHash`
- `status`
- `createdAt`
- `updatedAt`

### vehicles

- `id`
- `ownerId`
- `vehicleCode`：二维码公开码，使用不可猜测随机值
- `plateNumber`
- `plateDisplay`
- `brandModel`
- `color`
- `parkingHint`
- `ownerPhone`
- `pushplusToken`
- `allowPhoneCall`
- `allowWechatNotify`
- `status`
- `createdAt`
- `updatedAt`

### move_requests

- `id`
- `vehicleId`
- `requestCode`
- `locationText`
- `latitude`
- `longitude`
- `mapUrl`
- `message`
- `ipHash`
- `userAgent`
- `notifyChannel`
- `notifyStatus`
- `notifyResponse`
- `createdAt`

### rate_limits

- `id`
- `scope`
- `scopeKey`
- `expiresAt`
- `createdAt`

## API 边界

公开接口：

- `GET /c/{vehicleCode}`：扫码页。
- `GET /api/public/vehicles/{vehicleCode}`：获取可公开展示的车辆核对信息。
- `POST /api/public/vehicles/{vehicleCode}/notify`：提交微信提醒。

登录接口：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

后台接口：

- `GET /api/admin/owners`
- `POST /api/admin/owners`
- `GET /api/vehicles`
- `POST /api/vehicles`
- `PUT /api/vehicles/{id}`
- `DELETE /api/vehicles/{id}`
- `GET /api/vehicles/{id}/qr`
- `GET /api/move-requests`

## 安全和风控

- 车辆公开码必须不可枚举，不使用自增 ID。
- 后台必须登录。
- 车主只能访问自己的车辆和请求记录。
- PushPlus token 和手机号不返回给公开扫码页，除非电话联系功能需要生成拨号链接。
- 微信提醒接口需要限流：
  - 同一车辆 60 秒内默认只允许一次提醒。
  - 同一 IP 或同一浏览器指纹短时间多次请求应被限制。
- 后台登录失败需要限流。
- 日志不得打印 PushPlus token、Amap key、密码哈希或完整手机号。

## 部署

群晖部署通过 Docker Compose 提供：

- `app` 暴露容器内端口，例如 `3000`。
- `cloudflared` 使用 Cloudflare Tunnel token 连接 Cloudflare。
- SQLite 文件挂载到群晖目录，例如 `/volume1/docker/move-car/data/app.db`。

关键环境变量：

- `EXTERNAL_URL=https://car.example.com`
- `APP_PORT=3000`
- `DATABASE_URL=file:/data/app.db`
- `SESSION_SECRET`
- `ADMIN_INITIAL_PASSWORD`
- `DEFAULT_RATE_LIMIT_SECONDS=60`
- `CLOUDFLARE_TUNNEL_TOKEN`

二维码链接和 PushPlus 消息链接必须使用 `EXTERNAL_URL` 生成，不能出现内网 IP 或非标准端口。

## 测试策略

- 单元测试：
  - 车辆公开码生成不可预测。
  - 车主权限隔离。
  - 限流逻辑。
  - PushPlus 请求体构造。
- API 测试：
  - 扫码页车辆不存在、禁用、可用三种状态。
  - 提醒接口成功、限流、通知失败三种状态。
  - 车主无法访问他人车辆。
- UI 测试：
  - 移动端扫码页车辆核对信息完整。
  - 电话开关和微信提醒开关正确控制按钮显示。
  - 定位失败时可以手填位置。
- 部署验证：
  - `docker compose config` 通过。
  - 本地容器健康检查通过。
  - 通过 Cloudflare Tunnel 域名访问扫码页。
  - 真实或模拟 PushPlus token 发送测试消息。

## 后续扩展

- WxPusher、Server 酱、企业微信、短信、语音通知。
- 虚拟号或中间号，隐藏车主手机号。
- 请求完成状态，例如车主点击“已收到/正在挪车”。
- 多租户品牌页和二维码样式模板。
- PostgreSQL 数据库选项。
