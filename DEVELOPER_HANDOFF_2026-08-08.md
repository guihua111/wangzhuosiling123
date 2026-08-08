# FinReach 开发交接文档（2026-08-08）

> 目的：供下一位开发者在新对话或新环境中快速恢复本项目的产品、代码、数据库和未完成事项。本文不包含任何密码、数据库连接串或令牌。

## 1. 项目背景

### 1.1 产品目标

项目是一个基于 ShipAny Two 脚手架改造的零售信贷展业 SaaS 产品，产品名为“零售信贷展业助手”（英文文案中使用 FinReach / Retail Lending Assistant）。产品面向零售客户经理，目标是将客户筛选、访谈、材料、画像、产品建议、话术、跟进和总结串成可复核的展业工作流。

线上域名为 `https://www.finreach.site/`，GitHub 仓库为 `git@github.com:guihua111/wangzhuosiling123.git`，本地工作目录为：

`D:\wangzuoAI\shipany-template-two-dev`

### 1.2 产品流程与核心页面

主要业务流程：

客户台账与筛选 → 确定当前客户 → 智能访谈管理 → 证照与流水 OCR → 统一客户画像 → 产品匹配 → 智能营销话术 → 材料与跟进管理 → 一键总结。

当前 8 个工作模块的路由：

| 模块 | 路由 |
| --- | --- |
| 客户台账与筛选 | `/workbench/customer-ledger` |
| 智能访谈管理 | `/workbench/interview-management` |
| 证照与流水 OCR | `/workbench/document-ocr` |
| 统一客户画像 | `/workbench/customer-profile` |
| 产品匹配 | `/workbench/product-matching` |
| 智能营销话术 | `/workbench/marketing-scripts` |
| 材料与跟进管理 | `/workbench/materials-followup` |
| 一键总结 | `/workbench/summary` |

用户确定某名客户后，链接会携带 `customer`（脱敏姓名）和 `customerId`，其他 7 个模块顶部显示“当前客户”。当前只有客户台账已经接入真实后端；其他模块仍为前端演示数据。

### 1.3 技术栈

- Next.js 16.2.12 + React + TypeScript
- Tailwind CSS、Radix UI、Lucide 图标
- next-intl（中文、英文）
- Better Auth（邮箱/密码认证）
- Drizzle ORM + PostgreSQL（Neon）
- `postgres` 驱动
- Vercel 部署
- 包管理：pnpm

认证入口：`src/app/api/auth/[...all]/route.ts`。

数据库配置：`src/config/index.ts`、`src/core/db/*`、`src/config/db/schema.postgres.ts`。

## 2. 已完成工作情况

### 2.1 既有前端成果（本会话前已完成）

- Landing Page 已替换为零售信贷展业助手内容，含 Hero、客户痛点、四步流程、八个核心工作模块等。
- 八个模块均有独立工作台页面和可交互的前端演示。
- 客户台账已具备筛选、录入、CSV 导入/导出、选择客户、跨模块传递等前端能力。
- 客户列表已改为脱敏人名，客户画像字段已把“客户名称”改为“企业名称”。
- 客户痛点、营销/材料/画像/产品等页面文案已做中英文同步。
- 登录、注册与退出此前做过修复；当前 Better Auth 配置中邮箱密码登录已启用。

关键前端文件：

- `src/themes/default/blocks/retail-workbench.tsx`
- `src/themes/default/blocks/retail-feature-page.tsx`
- `src/config/locale/messages/zh/pages/workbench.json`
- `src/config/locale/messages/en/pages/workbench.json`
- `src/config/locale/messages/zh/pages/features.json`
- `src/config/locale/messages/en/pages/features.json`

### 2.2 本轮已实现的后端基础能力

本轮确认的范围：团队共享客户；一名客户不能被多人共同编辑；OCR 和大模型暂不开发；产品匹配未来采用固定规则，不接入模型推理。

#### 数据模型

已在 `src/config/db/schema.postgres.ts` 新增：

- `retail_team`：团队租户。
- `retail_team_member`：团队成员；通过用户唯一索引限制一个用户当前只属于一个零售团队。
- `retail_customer`：客户台账。包含团队 ID、唯一负责人、联系人姓名、企业名称、行业、流水、贷款、跟进、优先级、分组、版本号、审计创建/更新人、软删除时间。
- `retail_customer_audit_log`：创建、修改、删除、初始化等客户操作日志。

权限规则已落地：

- 团队所有成员可读取该团队的客户。
- 创建客户的人自动成为该客户唯一负责人。
- 只有负责人可以编辑或软删除该客户；其他成员在页面中会看到禁用的编辑/删除按钮。
- 团队负责人可以通过 API 将已注册且尚未加入其他零售团队的用户加入团队。
- 用户第一次访问零售 API 时，会懒初始化个人团队及 owner 成员关系；不是在注册钩子中立即创建。

#### 新增后端接口

所有接口需有效登录会话，返回格式为 `{ code, message, data }`：

| 方法 | 地址 | 作用 |
| --- | --- | --- |
| GET | `/api/retail/customers` | 分页、搜索、分组筛选客户列表 |
| POST | `/api/retail/customers` | 新建客户，当前登录用户成为负责人 |
| GET | `/api/retail/customers/:id` | 读取团队内客户详情 |
| PATCH | `/api/retail/customers/:id` | 负责人更新客户；支持 `version` 乐观锁 |
| DELETE | `/api/retail/customers/:id` | 负责人软删除客户 |
| POST | `/api/retail/customers/import` | 批量导入，最多 500 条 |
| POST | `/api/retail/customers/bootstrap` | 空团队首次写入前端演示客户；团队行锁避免重复初始化 |
| GET | `/api/retail/customers/export` | 按筛选条件导出 CSV |
| GET | `/api/retail/team` | 获取当前团队和成员 |
| GET/POST | `/api/retail/team/members` | 查看成员 / 团队负责人按已注册邮箱添加成员 |

相关关键文件：

- `src/shared/models/retail.ts`：团队上下文、客户序列化、团队成员和审计逻辑。
- `src/shared/validators/retail.ts`：Zod 请求校验。
- `src/shared/lib/retail-api.ts`：统一 API 成功/错误响应。
- `src/app/api/retail/**`：路由实现。

#### 前端后端接入

`src/themes/default/blocks/retail-workbench.tsx` 已改为：

- 首次进入客户台账请求 `/api/retail/customers`；若团队没有客户，调用 `/bootstrap` 写入当前演示数据。
- “录入台账”调用 `POST /api/retail/customers`。
- CSV 导入调用 `/import`。
- 导出改为调用后端 `/export`。
- 新增“操作”列，负责人可编辑、删除；编辑使用 PATCH，删除使用 DELETE。
- 选择、确定客户时将客户 ID 和脱敏名写入 URL，供后续模块使用。

#### 登录保护与密码重置后端

- `src/proxy.ts` 已将 `/workbench` 加入登录保护，并禁止工作台页面被公共 CDN 缓存。
- `src/core/auth/config.ts` 新增密码重置邮件发送配置：当系统配置中存在 `resend_api_key` 时，Better Auth 的重置密码接口可用，令牌有效期 1 小时。
- 新增邮件模板：`src/shared/blocks/email/reset-password.tsx`。
- 注意：当前没有“忘记密码 / 重置密码”前端页面；仅后端认证能力和邮件模板已准备。

### 2.3 数据库迁移与真实数据库状态

迁移文件：

- `src/config/db/migrations/0000_long_nova.sql`
- `src/config/db/migrations/meta/0000_snapshot.json`
- `src/config/db/migrations/meta/_journal.json`

已使用当前 `.env.development` 中配置的 Neon PostgreSQL 连接确认，以下表存在：

- `retail_team`
- `retail_team_member`
- `retail_customer`
- `retail_customer_audit_log`

重要经过：

1. `drizzle-kit push` 首次对已有脚手架数据库同步时，因旧表主键历史差异失败，报错为 `column "id" is in a primary key`。该命令不应在当前已有生产数据库上直接重试。
2. 推送失败前数据库已创建上述零售表；随后已执行只包含零售表的 `0000_long_nova.sql`，该文件使用 `CREATE TABLE/INDEX IF NOT EXISTS`，数据库迁移命令显示成功。
3. 该迁移是“已有 ShipAny 基础库”的增量基线：**在完全空白的数据库上单独运行它不会创建 Better Auth 等脚手架基础表**。新环境必须先初始化 ShipAny 基础数据库，再执行本项目迁移，或重新制作一套完整的干净基线迁移。

### 2.4 已完成验证

- `tsc --noEmit`：通过（后端及前端接入完成后执行）。
- `git diff --check`：通过；仅有 Windows 换行符提示。
- 真实 Neon 数据库：确认 4 张零售表存在。
- 端到端一次性测试账号验证：注册并自动登录 → 进入受保护工作台 → 自动创建团队 → 初始化 12 条演示客户 → 新建脱敏客户 → 编辑流水 → 确定当前客户并传递 `customerId` → DELETE 软删除 → 列表不再显示，全部通过。
- 测试账号、测试团队、演示客户和测试客户均已从数据库清理；清理结果为 `teams: 1, users: 1`，无刻意保留的测试数据。
- 生产构建：首次本地构建因无法访问 Google Fonts（JetBrains Mono、Merriweather、Noto Sans Mono）失败，不是 TypeScript 或本轮后端错误。之后启动了可联网重试，但会话被中断，**没有可确认的最终构建结果**。

## 3. Git 信息

当前分支：`main`

远程：

`origin git@github.com:guihua111/wangzhuosiling123.git`

最近已提交的 commit：

```text
0bf3da3 8月8日第三版修改增加了痛点，把八项工作改为图片，增加了登录功能
97563c1 第二次修改重新部署Vercel2026年8月6日
73b7885 feat: build retail lending assistant workspace
513226a Initial commit
```

当前工作区有未提交改动，**尚未执行 `git add`、`git commit` 或 `git push`**。其中包括本轮后端文件，也包含前续会话的前端文案和页面调整。提交前请完整审阅，而不是只提交单个文件。

当前已修改/新增的主要文件：

```text
M  src/config/db/schema.postgres.ts
M  src/config/locale/messages/en/pages/workbench.json
M  src/config/locale/messages/en/pages/workbench/customer-profile.json
M  src/config/locale/messages/zh/pages/workbench.json
M  src/config/locale/messages/zh/pages/workbench/customer-profile.json
M  src/core/auth/config.ts
M  src/proxy.ts
M  src/themes/default/blocks/retail-workbench.tsx
?? src/app/api/retail/
?? src/shared/blocks/email/reset-password.tsx
?? src/shared/lib/retail-api.ts
?? src/shared/models/retail.ts
?? src/shared/validators/
```

注意：`.gitignore` 当前包含 `src/config/db/migrations*`，因此迁移文件不会显示在 `git status` 中，也不会被正常提交。提交本轮改动前必须二选一：

1. 调整 `.gitignore`，使 `src/config/db/migrations/**` 可以纳入版本控制；或
2. 使用 `git add -f src/config/db/migrations/0000_long_nova.sql src/config/db/migrations/meta/*` 强制暂存。

否则其他开发者和 Vercel/新环境将拿不到本轮数据库迁移。（请再次运行 `git status --short`，因为本文档本身也会变为未跟踪文件。）

## 4. 关键决策

1. **团队共享但不多人协作**：用 `team_id` 实现数据共享；用 `owner_user_id` 实现单负责人写权限。团队成员只读非自己负责的客户，不做多人同时编辑、评论或协作锁。
2. **客户姓名脱敏展示**：后端对 `contact_name` 响应执行掩码，前端也保留了掩码函数，避免展示层泄漏。数据表当前仍保存录入的原始字符串，见“注意事项”。
3. **当前客户通过 URL 传递**：采用 `?customer=<脱敏名>&customerId=<UUID>`，而不是 localStorage，便于刷新和跨页面链接；后续模块落库时应优先使用 `customerId`，不要用姓名做关联键。
4. **固定规则方向**：本轮没有开发 OCR 和大模型，也没有调用 AI API。现有产品匹配页面仍是前端固定示例；下一阶段可将规则表和匹配服务落库。
5. **团队初始化时机**：第一次访问零售 API 时创建团队，避免注册阶段的钩子失败影响登录；代价是新注册用户在首次工作台请求前没有团队记录。
6. **客户删除采用软删除**：保留行和审计记录的历史价值，列表默认不返回 `deleted_at` 非空的客户。
7. **接口层使用 Zod 校验和乐观锁**：PATCH 接受 `version`，版本不一致返回 409，降低负责人在多设备操作时的覆盖风险。

## 5. 待解决问题与下一步计划

### P0：应在提交/部署前完成

- [ ] 在可访问 Google Fonts 的网络中完成一次 `next build`，并检查 Vercel Production 构建日志。当前类型检查通过，但完整生产构建未获得最终成功结论。
- [ ] 用真实账号验证：退出后重新登录、进入 `/workbench/customer-ledger`、新增/编辑/删除客户、刷新后数据仍存在。
- [ ] 在 Vercel 的 Production / Preview 环境配置并确认：`DATABASE_URL`、`DATABASE_PROVIDER=postgresql`、`AUTH_SECRET`、`AUTH_URL=https://www.finreach.site`、`NEXT_PUBLIC_APP_URL=https://www.finreach.site`，以及现有应用必须的 `NEXT_PUBLIC_*` 配置。不要把 `.env.development` 或秘密提交到 Git。
- [ ] 在 Vercel/线上数据库核查 `0000_long_nova` 的迁移记录及 4 张零售表。若线上库与本地 Neon 不是同一个数据库，需要单独执行迁移。
- [ ] 提交前审查 `src/config/db/migrations/0000_long_nova.sql`。它针对“已有脚手架基础表”的数据库；如需要支持空库一键初始化，应重建完整基线迁移方案。
- [ ] 审查和提交当前所有未提交文件，再推送 `main` 触发 Vercel 部署。

### P1：第一阶段仍未完整闭环的内容

- [ ] 团队成员管理目前只有后端接口，无前端“邀请/添加成员/成员列表”页面。
- [ ] 当前团队成员 API 只能添加“已注册且尚未加入任何零售团队”的用户；不支持邀请邮件、待接受邀请、多团队、移除成员、转移团队或转交客户负责人。
- [ ] 忘记密码的后端邮件能力已配置，但缺少“忘记密码”和“重置密码”前端页面；且依赖系统配置中有效的 `resend_api_key`。
- [ ] 其他 7 个模块目前只显示 `customerId` / 脱敏姓名，不保存访谈、画像、材料、话术、任务或总结数据；这些需要第二阶段的业务表和接口。
- [ ] CSV 导入/导出已接入后端。导出格式按“客户姓名、行业、流水、贷款、跟进、优先级、筛选类别”输出，以兼容当前前端导入解析；企业名称未出现在当前台账导出中。
- [ ] 当前前端默认会为新空团队写入演示客户。正式生产模式是否保留演示数据需要产品确认；若不保留，应去掉 `/bootstrap` 调用并显示空状态。

### P2：后续业务后端

- [ ] 固定产品规则：建立产品规则表、规则版本、规则管理后台和可解释匹配结果；不要接入大模型。
- [ ] 客户访谈记录、客户画像、材料清单、跟进任务、总结报告等按 `customer_id` 落库。
- [ ] 文件上传、私有对象存储、OCR 接口和人工校正流程（用户明确要求当前不开发）。
- [ ] 客户数据加密、访问审计查询、导出审批、数据保留/注销策略。
- [ ] 分页改为服务端驱动；当前工作台为简化演示，一次读取最多 500 条客户后在前端筛选。

## 6. 重要注意事项

### 安全与数据

- 数据库连接串、认证密钥曾在会话历史中出现过。建议立即在 Neon 和 Vercel 轮换 `DATABASE_URL` 密码及 `AUTH_SECRET`，并更新本地和线上环境变量。
- 数据表目前将 `contact_name` 原样保存，API 响应和前端显示会脱敏；这不等同于字段级加密。若投入真实金融客户数据，应增加应用层加密/密钥管理、私有审计和合规策略。
- API 已做团队隔离和负责人写权限，但尚未做速率限制、导出审批、细粒度 RBAC 或管理员审计页面。
- `/workbench` 已由 `src/proxy.ts` 保护；未登录访问会跳转到 `/sign-in`。API 路由再通过 Better Auth 做服务端会话校验。

### 环境与数据库

- 本地开发环境使用 `.env.development`，本地地址通常为 `http://localhost:3010`。项目根目录中存在 `.codex-dev-3010*.log` 等本地运行日志，不应提交。
- Next.js 构建会优先读取 `.env.production`，即使外层命令加载了 `.env.development`；确认生产构建时要核对实际环境变量来源。
- 项目用 Drizzle。不要在当前已有数据库上直接盲目运行 `drizzle-kit push`，该命令已经因旧基础表的主键差异失败过。优先使用审阅后的迁移。
- 迁移表及 schema 名称由 `DB_MIGRATIONS_TABLE`、`DB_MIGRATIONS_SCHEMA`、`DB_SCHEMA` 控制；当前默认迁移 schema 为 `drizzle`，业务表默认 schema 为 `public`。

### 前端与文案

- 当前客户台账显示的人名是脱敏名，客户画像里显示企业名称。不要把企业名称和联系人姓名混为同一个字段。
- `retail-workbench.tsx` 是大型客户端组件，已承担演示模块、客户 API 接入、选择状态和 CSV 解析。后续业务复杂后应拆分为独立模块/Hook，避免继续在单文件堆叠逻辑。
- 工作台中的“63 位客户”是既有展示逻辑：基于文案总数和本地表格行数计算。真实后端返回的当前团队客户数与展示数字可能不同；若转正式数据产品，应改为使用 API `total`。

## 7. 建议的新对话起步指令

新开发者可直接以以下内容作为新对话的首条任务：

```text
请阅读 D:\wangzuoAI\shipany-template-two-dev\DEVELOPER_HANDOFF_2026-08-08.md，继续 FinReach 零售信贷展业助手开发。
当前分支 main 有未提交的前端与后端改动。先运行 git status、tsc --noEmit，并检查 Vercel/Neon 环境；不要执行 git reset 或在现有数据库上盲目执行 drizzle-kit push。
```

## 8. 其他补充

无。

## 9. 第二阶段业务模块更新（2026-08-08）

本地未提交工作区已继续实现第二阶段业务后端，范围遵循：团队共享读取、客户唯一负责人写入、不做多人协作、不做 OCR、不调用大模型、产品匹配使用固定规则。

### 已新增

- 数据表 `retail_customer_case`：以 `customer_id` 唯一关联客户，持久化访谈纪要与结构化结果、人工材料登记、客户画像、固定规则匹配、营销话术、材料清单与跟进任务、展业总结；包含规则版本和乐观锁版本号。
- 接口 `GET/PATCH /api/retail/customers/:id/business`：团队成员可读，只有客户负责人可写；所有写入记录到既有客户审计日志。
- 固定规则服务 `src/shared/services/retail-business.ts`：负责关键词式访谈结构化、画像完整度与标签、信用经营贷/房产抵押经营贷评分及可解释理由、总结汇总。未调用任何 AI 服务。
- 前端七个业务模块已接入该接口，保存后刷新或跨模块可恢复；非负责人按钮禁用。
- “确认识别结果”会把人工修改后的企业名称、信用代码、经营者、成立日期和经营范围原子同步到统一客户画像；识别置信度仅保留在材料识别记录中。
- 数据库迁移 `0001_retail_business_case.sql` 已应用到当前 `.env.development` 对应的 Neon 数据库，并确认表存在。

### 重要边界

- “证照与流水 OCR”当前仅登记所选文件名并由客户经理人工录入、确认字段，不上传文件、不保存文件内容、不执行 OCR。
- 当前业务表使用受 Zod 校验的 JSON 文本快照，适合第二阶段单负责人工作流；若以后需要多人协作、任务统计、独立材料生命周期或复杂查询，应再拆为规范化子表。
- 第二阶段改动尚未提交或推送；迁移目录仍受 `.gitignore` 忽略，提交时需强制加入迁移文件或调整忽略规则。
