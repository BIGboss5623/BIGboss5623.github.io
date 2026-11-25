# BIGboss5623.github.io
ZGLAND 全站导航与杭州创投企业官网，共用仓库、独立首页。

2026-10-31运维升级：`/site-stats/`公开真实访问汇总与口径，`/site-blueprint/`保留可下载的建站与AI恢复规范。`operations/`为密码50次/1小时暂停、邮件队列与调度的规范源代码，详见其中README。真正写入数据和管理的认证由服务端保护；网络配置按站主要求保留浏览器本地解密，不依赖量化服务器在线。域名邮件改由自有服务器每月一次，到期前30天每天一次，旧GitHub定时发送已停用。

- `zgland.com` / `www.zgland.com`：`index.html`，子站总导航、搜索分类与常用操作。
- `hzct.zgland.com`：中间件仅将 `/`、`/index.html` 内部映射到 `/company-home`（文件 `company-home.html`），避免 Pages 的 .html 外跳；原企业子页面与资源路径保持不变。
- `/quant-console/`：量化操作导航及单次入口检查；写入操作在独立认证的云端工作台完成，不存储登录口令。
- `/api/quant-status`：仅固定目标的匿名可达性探测；401挑战只能说明入口认证存在，不代表业务健康或永久托管。无后台轮询/自动续期。
- 首页与 `/domain-console/#expiry` 显示域名到期倒计时；`/api/domain-expiry`通过Pages Function查询Verisign RDAP，按UTC+8日历天计算。日期每天递减，续费后可刷新。人工校正使用GitHub编辑 `config/domain-expiry.json` 的 `manual_expiry_date`（YYYY-MM-DD），设回null恢复自动查询。查询失败明确标明备用日期，不伪报实时成功。邮件规则见上述运维升级说明。
- `/games/rich4/`：大富翁4社区重制版下载与源码备份。本站保存2026-10-24下载的源码ZIP、许可与SHA-256；Windows完整包指向原作者0.7.4发行版，原游戏素材不重复公开镜像。源码包不等于可直接游玩的完整包。
- `/credentials/`：境内外证书互认与职业规划，2026-10-29首版34项、53条原文来源。数据在 `credentials/catalog.json`，按证书维护国内效力、境外用途、职称路径、门槛、维护要求和来源引用；不是实时政策接口。含国家/类别/职称筛选、最多三项并排比较、当前结果CSV导出、地区政策提示。更新时须重核原文、版本及适用边界，不能把地方职称申报条件写成全国自动换证；勿据会费推断头衔买卖。验证：`python scripts/test-credentials.py`；线上加 `--base https://zgland.com`。
- 免费云端可能休眠或回收，保留公开研究台和浏览器CSV回测作为替代。没有承诺自动恢复。
- 量化操作中心的状态备份初检仅在浏览器读取JSON并显示记录数，不上传文件、不执行恢复。完整兼容性检查与暂存恢复使用量化项目中的 `工具/restore_state_backup.py`，默认只检查，应用时仅允许新目录。

发布使用原 `上传.py`。相关验证：`python scripts/audit_links.py`、`node scripts/test-domain-api.cjs`、`node scripts/test-portal.cjs`、`node scripts/test-backup-check.cjs`。

- `/local-ai/`：本地 AI 与远程控制指南（2026-10-29核验），含 R1 量化硬件估算、Windows Ollama/Aider、ZeroTier、SSH 密钥、回环端口隧道与 RDP；复制命令、按内存选型、浏览器本地检查清单和打印。容量估算不是速度或代码正确性保证；仅提供步骤，不会安装软件或发起远程连接。首页与共用 portal 样式改为浅色；首页域名提醒随之调亮。验证：`python scripts/test-local-ai.py`。

- 2026-11-25 导航整理：总入口常用网站增加 OpenAI 和 ChatGPT 官方快捷链接，保留第三方非合作声明；FundPilot、钰玺医药、企业信息子页增加返回 ZGLAND 的清晰入口，企业信息子页首页链接统一指向 hzct.zgland.com。回归：node scripts/test-navigation-links.cjs。

- 2026-11-25 深度巡检：一键运行 python scripts/verify_site.py --mode both（可追加 --full 扫描全部主要页面），完成静态安全测试、本地浏览器检查与线上检查；报告保存在不上传的 本地留档/qa-reports。检测到真实线上 HTTP 错误仍会报警，仅本地静态服务器无法执行的已有 Cloudflare Function 返回 404 被单独记录。浏览器检查需要 Playwright 和 Edge，可通过 PLAYWRIGHT_MODULE 指定本地已安装模块。巡检不执行部署或管理写入。

- 2026-11-25 公开统计连通性诊断：python scripts/check_tunnel_health.py 仅检查公开主页、统计 API 和认证网关，不读取口令；Cloudflare 530 / 1033 直接标记为 Tunnel 断连，HTTP 401 仅代表认证网关可达，不能代替业务健康确认。网站发布与自有服务器维护分离；不可因统计断连而伪造访问数据。

- 2026-11-25 巡检结果区分公开页面发布就绪与独立量化后台健康：已确认的 /site-stats/ 对 /api/site-stats 返回 503 仅标注私人统计后台降级；其他接口失败、页面溢出、脚本错误、异常埋点均阻止公开站发布就绪。整体健康状态仍保持严格失败，不掩盖统计服务故障。
