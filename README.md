# 扫码挪车

群晖 NAS 自部署扫码挪车系统。扫码人核对车牌和车辆信息后，可以通过 PushPlus 微信提醒车主，也可以按车辆配置直接电话联系车主。系统支持多车主、多车辆、二维码、请求记录和基础限流。

## 部署目录

本项目按以下群晖目录部署：

```bash
/volume2/docker/nuoche
```

SQLite 数据库和运行数据保存在：

```bash
/volume2/docker/nuoche/data/app.db
```

## Lucky 反代部署

应用容器只在群晖内网开放普通 HTTP 端口，由 Lucky 负责公网 HTTPS 反代。二维码链接使用 Lucky 对外提供的 HTTPS 地址，例如：

```text
https://car.example.com/c/车辆码
```

默认宿主机端口：

```text
13004 -> 容器 3000
```

Lucky 反代目标填写：

```text
http://群晖内网IP:13004
```

## 快速启动

```bash
cd /volume2/docker/nuoche
cp .env.example .env
mkdir -p /volume2/docker/nuoche/data
```

编辑 `.env`：

```dotenv
EXTERNAL_URL=https://car.example.com
APP_PORT=3000
HOST_PORT=13004
DATABASE_URL=file:/data/app.db
SESSION_SECRET=至少32位随机字符串
ADMIN_INITIAL_PASSWORD=初始管理员密码
DEFAULT_RATE_LIMIT_SECONDS=60
```

启动：

```bash
docker compose up -d --build
```

健康检查：

```bash
curl -fsS http://127.0.0.1:13004/api/health
```

公网验证：

```text
https://car.example.com/api/health
```

## 使用流程

1. 访问 `/login`，用初始管理员账号登录。
2. 创建车主账号。
3. 创建车辆，填写车牌、车型、颜色、停车提示、手机号、PushPlus token。
4. 下载车辆二维码。
5. 用微信扫描二维码，确认页面能正常打开。
6. 测试微信提醒和电话联系。

## 注意事项

- `.env` 不要提交到 Git，里面包含会话密钥和初始密码。
- 二维码和推送消息链接必须来自 `EXTERNAL_URL`，不要使用内网 IP 或容器端口 `:3000`。
- 如果 `EXTERNAL_URL` 使用非标准 HTTPS 端口，微信仍可能提示或限制访问；更稳妥的公网入口是标准 `443`。
- PushPlus token 按车辆配置，便于后续多车主多车辆独立推送。
- 电话联系会暴露手机号；如果需要更强隐私，后续接入中间号或语音通知通道。
