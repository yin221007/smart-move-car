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

## Cloudflare Tunnel

家用宽带无需开放 443 端口。二维码链接使用标准 HTTPS 域名，例如：

```text
https://car.example.com/c/车辆码
```

在 Cloudflare Zero Trust 创建 Tunnel 后，把 Public Hostname 指向：

```text
http://app:3000
```

然后把 Tunnel token 写入 `.env` 的 `CLOUDFLARE_TUNNEL_TOKEN`。

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
DATABASE_URL=file:/data/app.db
SESSION_SECRET=至少32位随机字符串
ADMIN_INITIAL_PASSWORD=初始管理员密码
DEFAULT_RATE_LIMIT_SECONDS=60
CLOUDFLARE_TUNNEL_TOKEN=Cloudflare生成的TunnelToken
```

启动：

```bash
docker compose up -d --build
```

健康检查：

```bash
curl -fsS http://127.0.0.1:3000/api/health
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
5. 用微信扫描二维码，确认页面不出现非标准端口。
6. 测试微信提醒和电话联系。

## 注意事项

- `.env` 不要提交到 Git，里面包含 Tunnel token、会话密钥和初始密码。
- 二维码和推送消息链接必须来自 `EXTERNAL_URL`，不要使用内网 IP 或 `:3000` 端口。
- PushPlus token 按车辆配置，便于后续多车主多车辆独立推送。
- 电话联系会暴露手机号；如果需要更强隐私，后续接入中间号或语音通知通道。
