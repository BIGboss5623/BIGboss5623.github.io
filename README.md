# BIGboss5623.github.io
ZGLAND 全站导航与杭州创投企业官网，共用仓库、独立首页。

- `zgland.com` / `www.zgland.com`：`index.html`，子站总导航、搜索分类与常用操作。
- `hzct.zgland.com`：中间件仅将 `/`、`/index.html` 映射到 `company-home.html`，原企业子页面与资源路径保持不变。
- `/quant-console/`：量化操作导航及单次入口检查；写入操作在独立认证的云端工作台完成，不存储登录口令。
- `/api/quant-status`：仅固定目标的匿名可达性探测；401挑战只能说明入口认证存在，不代表业务健康或永久托管。无后台轮询/自动续期。
- 免费云端可能休眠或回收，保留公开研究台和浏览器CSV回测作为替代。没有承诺自动恢复。

发布使用原 `上传.py`。相关验证：`python scripts/audit_links.py`、`node scripts/test-domain-api.cjs`、`node scripts/test-portal.cjs`。
