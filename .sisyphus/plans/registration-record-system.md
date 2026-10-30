## Plan Title

登记记录系统开发计划

## TL;DR
- 客户端：Windows 与 macOS 的桌面应用（前端）
- 服务端：部署在群晖 DSM 7.3 的 Container Manager
- 数据库：群晖自带的 MariaDB 10，当前端口 3306 已被占用，需要并行/替代方案
- 存储：群晖根目录 Docker 目录用于上传的图片、文档、视频等
- 角色与认证：用户/管理员可切换登录入口；实现用户注册、忘记密码（用户与管理员）
- 里程碑：确认技术栈、数据模型、认证与授权、文件存储、日志、备份、测试、CI/CD

## Context
### 原始需求
- 前端桌面应用，支持 Windows 与 macOS 安装
- 后端部署在 Synology DSM 7.3 的 Container Manager
- MariaDB 10 作为数据库，端口 3306 已占用
- 文件存放在群晖 Docker 根目录映射的目录
- 登录入口包含用户/管理员切换、用户注册、忘记密码
- 选定技术栈（基于当前用户偏好）：前端封装为 Electron 桌面应用；后端使用 Node.js + Express；数据库在群晖 DSM 7.3 中的 MariaDB 10；端口冲突问题通过镜像/映射策略解决
- 部署与存储约束：后端应用运行于 Synology 的容器环境，使用 DSM 的 Docker 根目录映射存放上传的图片、文档、视频等文件
- 端口策略：MariaDB 的宿主机端口将改用 3307 映射（3306 被占用时的推荐方案），数据库连接通过该端口对外暴露，应用内通过受信任网络访问
- MVP 功能要点：用户/管理员登录切换、注册、忘记密码、记录的增删改查、附件上传、角色权限控制
- Selected Technology Stack:
- - Frontend: Electron（跨平台桌面应用）
- - Backend: Node.js + Express
- - Database: Synology DSM 7.3 上的 MariaDB 10
- - Storage: 群晖 Docker 根目录映射的上传目录
- - Auth: JWT + 基础的邮箱/验证码忘记密码流程（后续可扩展）
- - 部署: 通过 DSM 的 Container Manager 部署服务，MariaDB 独立容器/已有 MariaDB 实例，前后端服务通过私有网络通讯
- - 端口策略: 宿主机端口 3307 映射到 MariaDB 容器的 3306，避免 3306 冲突
- 风险与依赖：需要确认 DSM 端网络配置、文件系统权限、密钥管理和邮件/验证码服务；同时需确保对接的 MariaDB 实例具有可用性与备份策略

## 部署与端口策略（补充说明）
- 当前群晖 DSM 上的 MariaDB 10 已在宿主机端口 3306 占用。后端应用容器应通过 DSM 内部网络访问该 MariaDB 实例，而非暴露宿主机的 3306 端口给外部网络。需在 MariaDB 端开启远程访问权限，并创建专用数据库/用户供应用使用。
- 如需进一步解耦，可在 DSM 上将 MariaDB 迁移至容器并使用不同端口（示例：3307），但这涉及数据迁移和额外配置，需在计划内列出对应风险与回退方案。
- 文件上传的存储目录建议映射为 DSM 的一个持久卷（如 /volume1/docker/registrations/uploads），并在应用中对上传内容进行类型/大小等校验。

### 面试/评审结论（待 Metis/Oracle 确认后填写）
- 当前阶段计划在选型与方案设计层面完成决策，待后续深入时再填充具体实现细节与风险

## Work Objectives
### Core Objective
- 构建一个可部署的登记记录系统原型，具备基线的用户/管理员认证、注册、密码找回、记录的增删改查以及文件上传功能，且与现有的 Synology 设施对接（MariaDB、Docker 存储卷）

### Deliverables
- 设计文档（数据模型、接口草案、部署架构草图）
- 最小可行实现（MVP）的计划书与测试方案
- 初始计划的风险与缓解措施

### Definition of Done（可执行验证条件）
- 数据库模式与表结构设计完成，能创建用户、角色、会话、记录及附件记录
- 登录/注册/忘记密码工作流程的高保真流程图与用例描述
- 文件上传组件能够将上传的文件落地到指定的群晖 Docker 目录，并在 DB/记录中引用
- 前端桌面应用能够与后端 API 进行基本交互（登录、注册、记录 CRUD）
- 基线测试用例覆盖核心功能（单位测试/集成测试）

### Must Have
- 用户/管理员身份分离与权限校验
- 注册、登录、忘记密码流程（可选的邮箱/验证码实现）
- 记录的增删改查以及附件上传与管理
- 基本的安全性与数据校验（输入校验、文件类型/大小限制）
- 基本自动化测试覆盖 MVP 核心路径
- 用户与管理员的身份区分、权限校验
- 注册、登录、忘记密码流程（邮箱/短信或简单验证码）
- 文件上传与附件管理（图片/文档/视频）
- 记录的增删改查，以及基本查询筛选
- 端到端的简单测试用例

### Must NOT Have
- 过度复杂的多租户设计、高可用分布式架构
- 未备案的外部依赖（如付费云服务）
- 任何未在计划中明确的高风险特性

## Verification Strategy
> ZERO HUMAN INTERVENTION — 所有验证由智能代理执行。
- 测试方案：前后端集成测试、API 测试、文件上传测试、边界用例测试
- QA 策略：每项功能都应包含自动化测试场景
- 证据：将产出测试报告与测试证据（报告文件路径）

## Execution Strategy
### Parallel Execution Waves
- Wave 1: Foundation Tasks
- - [ ] 1. Architecture confirmation and decision documentation (Frontend: Electron; Backend: Node.js/Express; Database: LAN MariaDB)
-   - Acceptance: 关键架构决策记录完备，Plan 中明确结论
-   - QA: 审阅检查点：是否覆盖前后端分层、网络、数据流、部署结构
- - [ ] 2. DSM 部署指南（卷映射、网络配置、上传目录持久化路径）
-   - Acceptance: 部署指南文档就绪，可直接执行
-   - QA: 路径、权限、挂载点是否可复制到实际 DSM 环境
- - [ ] 3. 数据模型初稿（users、roles、records、attachments、sessions 等实体/关系，ER 图与 SQL 架构）
-   - Acceptance: 模型草案与关系图存在
-   - QA: 外键、索引、数据类型合理性检查
- - [ ] 4. API 设计草案（核心端点：auth、users、records，OpenAPI 骨架）
-   - Acceptance: API 草案就绪，包含示例请求/响应
-   - QA: 与数据模型对齐、字段命名规范统一
- - [ ] 5. 附件存储计划（uploads 目录结构、权限、文件大小/类型校验规则）
-   - Acceptance: 存储结构与校验规则文档化
-   - QA: 上传大小限制、文件类型校验、存储路径落地测试
- - [ ] 6. 认证设计（密码哈希、JWT、忘记密码/重置流程设计）
-   - Acceptance: 认证设计文档可落地实现
-   - QA: 登录/注册流程的端到端测试场景草案
- - [ ] 7. 前端流程（登录、注册、忘记密码流程的草案/规格，角色切换入口）
-   - Acceptance: UI/UX 规格就绪
-   - QA: 基本的 UI 流程可映射到 API 调用
- - [ ] 8. 安全基线（输入校验、速率限制、令牌管理、密钥管理）
-   - Acceptance: 安全策略文档就绪
-   - QA: 常见攻击向量的输入/边界测试用例
- - [ ] 9. MVP 测试计划：单元/集成/接口测试要点及环境需求。
-   - Acceptance: 测试计划文档就绪，覆盖核心路径
-   - QA: Happy path 与边界条件的测试场景草案

- Wave 2: 待定（待 Wave 1 完成后填充）
### Wave 1: Foundation Tasks
- [ ] 1. Architecture confirmation and decision documentation (Frontend: Electron; Backend: Node.js/Express; Database: MariaDB via LAN).
  - Acceptance: 关键架构决策记录在 Plan 中，可直接落地实现。
- [ ] 2. DSM 部署指南：volume mappings、网络配置、上传目录持久化路径等。
  - Acceptance: 部署指南文档就绪。
- [ ] 3. 数据模型初稿：定义 users、roles、records、attachments、sessions 等实体与关系；提供 ER 图与初步 SQL 架构。
  - Acceptance: 模型草案与关系图存在。
- [ ] 4. API 设计草案：核心端点（auth、users、records）的路径与请求/响应结构，OpenAPI 骨架。
  - Acceptance: API 草案就绪。
- [ ] 5. 附件存储计划：uploads 目录结构、权限、文件大小/类型校验规则。
  - Acceptance: 存储策略文档化。
- [ ] 6. 认证设计：密码哈希、JWT、忘记密码/重置流程设计。
  - Acceptance: 认证设计文档可落地实现。
- [ ] 7. 前端流程：登录界面、注册界面、忘记密码流程的草案/规格。
  - Acceptance: UI/UX 规格就绪。
- [ ] 8. 安全基线：输入校验、速率限制、令牌管理、密钥管理的初步方案。
  - Acceptance: 安全计划文档就绪。
- [ ] 9. MVP 测试计划：单元/集成/接口测试要点及环境需求。
  - Acceptance: 测试计划文档就绪。

### Credential Handling Plan: Vault Injection Script Template (Final Text Version)
```bash
#!/usr/bin/env bash
set -euo pipefail

# Vault connection and AppRole placeholders (do not replace with real values here)
export VAULT_ADDR="{{VAULT_ADDR_PLACEHOLDER}}"
export ROLE_ID="{{ROLE_ID_PLACEHOLDER}}"
export SECRET_ID="{{SECRET_ID_PLACEHOLDER}}"

# Authenticate with Vault (AppRole)
vault login -method=approle role_id="$ROLE_ID" secret_id="$SECRET_ID" >/dev/null

# Retrieve DB credentials
DB_HOST=$(vault kv get -field=host secret/registration/db)
DB_PORT=$(vault kv get -field=port secret/registration/db)
DB_NAME=$(vault kv get -field=database secret/registration/db)
DB_USER=$(vault kv get -field=username secret/registration/db)
DB_PASSWORD=$(vault kv get -field=password secret/registration/db)

# Retrieve SSH credentials (if needed)
SSH_HOST=$(vault kv get -field=host secret/registration/ssh)
SSH_PORT=$(vault kv get -field=port secret/registration/ssh)
SSH_USER=$(vault kv get -field=username secret/registration/ssh)
SSH_KEY=$(vault kv get -field=private_key secret/registration/ssh)

export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
export SSH_HOST SSH_PORT SSH_USER SSH_KEY

echo "Credentials injected (masked for plan)."  # Do not print sensitive values in logs
```

### Vault Config Template (Placeholders)
```yaml
vault:
  address: "{{VAULT_ADDR_PLACEHOLDER}}"
  auth:
    type: approle
    role_id: "{{ROLE_ID_PLACEHOLDER}}"
    secret_id: "{{SECRET_ID_PLACEHOLDER}}"
  secret_paths:
    db: secret/registration/db
    ssh: secret/registration/ssh
```

### Execution Guidance
- Base your CI/CD execution on this template, replacing placeholders with actual values at runtime via Vault.
- Ensure TTL enforcement by Vault lease TTL and run-time cleanup of environment variables after tasks complete.
- Never log sensitive credentials; mask values in logs and artifacts.

### Start Work Guidance
- Start by validating Vault connectivity from the execution host, ensure role_id/secret_id are retrievable via secure channel, then test injecting DB/SSH credentials into a sandboxed environment before enabling real runs.

### Wave 1 Detailed Execution Plan (Expanded) - Final
- Task 1: Foundation & Plan alignment
  - 目标：同上
- Task 2: DSM LAN + MariaDB availability
- Task 3: Data model design (MariaDB schema)
- Task 4: API design & contracts (Express endpoints)
- Task 5: Attachments storage strategy
- Task 6: Authentication flow design (email verification, reset)
- Task 7: Frontend Electron UI skeleton (login/register/records)
- Task 8: Security baseline, logging, and audit
- Task 9: MVP testing plan (data management, rollback)

注：以上 Wave 1 任务的凭据获取与注入入口点统一指向 Vault AppRole 的占位符路径，实际执行由 Vault 注入。请在执行阶段确保 Vault 员工/运维团队有权限访问对应路径、并遵循最小权限原则。
```

- Credential Handling Plan (Do not store real credentials in plan artifacts)
- 目标原则：在计划阶段仅使用占位符，并定义凭据获取/注入流程，确保执行时能够安全地读取真实凭据（来自 Vault 等密钥管理服务）。默认实现为 Vault AppRole 动态凭据。
- 选型（默认实现路径）：A) Vault 动态凭据（AppRole）
- 备用选项（如需时可替换）：B) 受控的密码管理工具；C) 离线加密传输方案。
- 预置占位符（请勿写入真实值）：
  - DB_HOST_PLACEHOLDER
  - DB_PORT_PLACEHOLDER
  - DB_NAME_PLACEHOLDER
  - DB_USER_PLACEHOLDER
  - DB_PASSWORD_VAULT_PATH_PLACEHOLDER
  - SSH_HOST_PLACEHOLDER
  - SSH_PORT_PLACEHOLDER
  - SSH_USER_PLACEHOLDER
  - SSH_KEY_VAULT_PATH_PLACEHOLDER
- Vault AppRole 执行流程示例（执行阶段执行，计划中以文本占位符指引）
  - 1) 设置 Vault 相关参数占位符：VAULT_ADDR_PLACEHOLDER、ROLE_ID_PLACEHOLDER、SECRET_ID_PLACEHOLDER，以及 KV 路径占位符。
  - 2) 登录 Vault（执行阶段通过 REST/CLI 获取临时凭据）
     命令示例（占位符）: vault login -method=approle role_id="ROLE_ID_PLACEHOLDER" secret_id="SECRET_ID_PLACEHOLDER"
  - 3) 读取凭据（KV v2 路径示例，实际路径请按环境替换）
     示例（占位符）: DB_HOST=$(vault kv get -field=host secret/registration/db)
  - 4) 将凭据注入到执行环境变量（DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD，及 SSH 相关变量）
  - 5) TTL 与轮换：凭据设定一个 TTL（如 1 小时），执行完成后触发轮换或撤销。
- 安全审计与回滚
- 对凭据读取进行日志记录，包含时间、请求方、凭据类型、TTL，以及 Vault 路径的脱敏描述。
- 故障处理与回滚
- 若凭据获取失败，执行应中止并返回明确错误；提供回退策略（使用最近有效凭据或进入只读模式的选项）。
- 离线演练与文档
-  - 增加一个凭据注入演练步骤，用于 CI/CD 的验证和回溯。

### Vault Injection Script Template (Placeholders Only)
```bash
#!/usr/bin/env bash
set -euo pipefail

# Vault connection and AppRole placeholders (do not replace with real values here)
export VAULT_ADDR="{{VAULT_ADDR_PLACEHOLDER}}"
export ROLE_ID="{{ROLE_ID_PLACEHOLDER}}"
export SECRET_ID="{{SECRET_ID_PLACEHOLDER}}"

# Authenticate with Vault (AppRole)
vault login -method=approle role_id="$ROLE_ID" secret_id="$SECRET_ID" >/dev/null

# Retrieve DB credentials
DB_HOST=$(vault kv get -field=host secret/registration/db)
DB_PORT=$(vault kv get -field=port secret/registration/db)
DB_NAME=$(vault kv get -field=database secret/registration/db)
DB_USER=$(vault kv get -field=username secret/registration/db)
DB_PASSWORD=$(vault kv get -field=password secret/registration/db)

# Retrieve SSH credentials (if needed)
SSH_HOST=$(vault kv get -field=host secret/registration/ssh)
SSH_PORT=$(vault kv get -field=port secret/registration/ssh)
SSH_USER=$(vault kv get -field=username secret/registration/ssh)
SSH_KEY=$(vault kv get -field=private_key secret/registration/ssh)

export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
export SSH_HOST SSH_PORT SSH_USER SSH_KEY

echo "Credentials injected (masked for plan)."  # Do not print sensitive values in logs
```

### Vault Config Example (Placeholders)
```yaml
vault:
  address: "{{VAULT_ADDR_PLACEHOLDER}}"
  auth:
    type: approle
    role_id: "{{ROLE_ID_PLACEHOLDER}}"
    secret_id: "{{SECRET_ID_PLACEHOLDER}}"
  secret_paths:
    db: secret/registration/db
    ssh: secret/registration/ssh
```

### Execution Guidance
- Base your CI/CD execution on this template, replacing placeholders with actual values at runtime via Vault.
- Ensure TTL enforcement by Vault lease TTL and run-time cleanup of environment variables after tasks complete.
- Never log sensitive credentials; mask values in logs and artifacts.

### Wave 2: 待定（待 Wave 1 完成后填充）
### Wave 3: Records enhancement, export, notifications, auditing, admin UI
- Task 3.1: Records 搜索与筛选增强
- Task 3.2: 导出功能扩展（CSV/Excel/PDF）
- Task 3.3: 通知与事件驱动（邮件/站内通知）
- Task 3.4: 审计日志与合规强化
- Task 3.5: Admin 面板增强与权限可视化
- 说明：Wave 3 将基于 Wave 2 的后端 API 完善查询、导出、通知与审计能力，并扩展 Admin 端的可观测性。
 
### Wave 3 Detailed Runbook (3.1–3.5)
- Task 3.1 Runbook: Implement backend search and frontend search UI with filters; include example queries and expected outputs.
- Task 3.2 Runbook: Implement backend/export CSV and Excel; add frontend trigger and downloadable output; include sample data and file path.
- Task 3.3 Runbook: Implement notification service flow; trigger on events; ensure toggle switch and logs.
- Task 3.4 Runbook: Extend audit_log; add admin API endpoints for audit; verify desensitization and retention policy.
- Task 3.5 Runbook: Admin panel integration; implement user/record views, role-based access controls; ensure audit linkage.

### Start Work & Evidence Plan
- Start Work entry must be wired to Wave 3 execution; create a plan block with steps to trigger Wave 3 runbooks and collect evidence at each step.
- Evidence paths: .sisyphus/evidence/task-3.x-runbook.md for cross-reference.

### Execution Runbook (Patch A: 详细执行 Runbook for Wave 1)
#### Task 1: Foundation & Plan alignment
- Dependencies: None
- Steps:
  1. Confirm Wave 1 nine tasks remain as the executing backlog and ensure Vault-based credentials outline is present.
  2. Validate that TDD templates, data dictionary, guardrails, and sample AC for Task 3 exist in plan.
  3. Produce an initial runproof entry in .sisyphus/evidence/task-1-runbook.md.
- Expected Output: Confirmed plan structure and acceptance criteria anchors for downstream tasks.
- Acceptance Criteria:
  - [ ] TDD templates available
  - [ ] Data dictionary naming defined
  - [ ] Guardrails defined
  - [ ] Sample AC for Task 3 included
- QA Scenarios:
  - Happy Path: All required sections exist and are referenceable
  - Edge Case: Missing section triggers remediation note
- Evidence Path: .sisyphus/evidence/task-1-runbook.md

- Dependencies/Notes: This task is a foundational setup for the whole Wave 1 execution.

#### Task 2: DSM LAN + MariaDB availability
- Dependencies: Task 1
- Steps:
  1. Validate LAN connectivity to MariaDB (192.168.x.x:3306) from build/run agents.
  2. Confirm DSM volume mounts for data/attachments exist and have correct permissions.
  3. Document credential handling flow as plan guidance.
  4. Create evidence file task-2-runbook.md.
- Evidence Path: .sisyphus/evidence/task-2-runbook.md
- Acceptance Criteria:
  - [ ] LAN access to MariaDB works
  - [ ] Volumes exist and writable
  - [ ] Credential handling flow documented
  - [ ] Rollback plan documented
QA:
  - Happy Path: Connectivity and volume checks pass
  - Edge Case: MariaDB unreachable, fallback documented

#### Task 3: Data model design (MariaDB schema)
- Dependencies: Task 2
- Steps:
  1. Draft core schema (Users, Roles, Sessions, Records, Attachments, Audit).
  2. Produce ERD and initial DDL, map to API contracts.
  3. Save runbook evidence as task-3-runbook.md.
- Evidence Path: .sisyphus/evidence/task-3-runbook.md
- Acceptance Criteria:
  - [ ] ERD/DDL exists and FK/indices defined
  - [ ] Data model aligns with API contracts
QA:
  - Happy Path: All relations consistent
  - Edge Case: Missing FK constraint

#### Task 4: API design & contracts (Express)
- Dependencies: Task 3
- Steps:
  1. Draft API contracts for auth, users, records, attachments
  2. Produce OpenAPI skeleton and mapping to data model
  3. Save evidence task-4-runbook.md
- Evidence Path: .sisyphus/evidence/task-4-runbook.md
- Acceptance Criteria:
  - [ ] OpenAPI/spec exists
  - [ ] Endpoints mapped to data model
  - [ ] Validation/error handling defined
QA:
  - Happy Path: Valid request/response patterns
  - Edge Case: Invalid payload returns proper error codes

#### Task 5: Attachments storage strategy
- Dependencies: Task 4, Task 3
- Steps:
  1. Define storage layout, per-type size limits, virus scanning plan
  2. Define API mappings for attachments
  3. Save evidence task-5-runbook.md
- Evidence Path: .sisyphus/evidence/task-5-runbook.md
- Acceptance Criteria:
  - [ ] Storage path & permissions defined
  - [ ] Type-based size limits defined
  - [ ] Virus scanning hook plan outlined
QA:
  - Happy Path: Upload succeeds and metadata captured
  - Edge Case: Oversize triggers proper error

#### Task 6: Authentication flow design (email verification, reset)
- Dependencies: Task 4
- Steps:
  1. Define state machine, TTLs, verification flow
  2. Map to endpoints
  3. Save evidence task-6-runbook.md
- Evidence Path: .sisyphus/evidence/task-6-runbook.md
- Acceptance Criteria:
  - [ ] State machine diagram exists
  - [ ] Token TTL/rotation defined
  - [ ] Email verification endpoints defined
QA:
  - Happy Path: Register > verify > login > reset
  - Edge Case: Expired token handling

#### Task 7: Frontend Electron UI skeleton
- Dependencies: Task 4, Task 6
- Steps:
  1. Outline UI for Login/Register/Records
  2. Define data fetch flows and token storage strategy
  3. Save evidence task-7-runbook.md
- Evidence Path: .sisyphus/evidence/task-7-runbook.md
- Acceptance Criteria:
  - [ ] App boots and shows main window
  - [ ] Screens for login/register/record creation exist
  - [ ] API integration wired
QA:
  - Happy Path: Login works against API mock
  - Edge Case: Network error handling

#### Task 8: Security baseline, logging, and audit
- Dependencies: Task 6, Task 7
- Steps:
  1. Draft RBAC, password hashing strategy, session policy
  2. Outline logging and audit trail
  3. Save evidence task-8-runbook.md
- Evidence Path: .sisyphus/evidence/task-8-runbook.md
- Acceptance Criteria:
  - [ ] RBAC model documented
  - [ ] Hashing strategy defined
  - [ ] Logging/audit plan defined
QA:
  - Happy Path: Correct permission checks
  - Edge Case: Unauthorized access attempt

#### Task 9: MVP testing plan
- Dependencies: Task 7, Task 8, Task 4
- Steps:
  1. Outline unit/integration/e2e plan
  2. Define data fixtures and rollback checks
  3. Save evidence task-9-runbook.md
- Evidence Path: .sisyphus/evidence/task-9-runbook.md
- Acceptance Criteria:
  - [ ] Complete test plan
  - [ ] Data fixtures defined
  - [ ] CI integration plan
QA:
  - Happy Path: CI runs green with mock data
  - Edge Case: DB outage scenarios covered

### Execution Support Artifacts (Stage summaries, evidence)
- Stage summaries prepared after each Runbook stage (Wave 1 completion, etc.).
- Evidence: downstream evidence files created under .sisyphus/evidence/ with naming task-<N>-<slug>.<ext>.

### Evidence Metadata Schema
- Fields: task_id, stage, slug, timestamp, status, outcome, evidence_path, responsible, notes

### Start Work & Blocking Strategy (Patch D)
- Start Work: /start-work 触发后续波次执行，系统按阶段推进并输出证据链接
- 阻塞策略：A) 暂停并通知；B) 切换到备用凭据提供者（Vault 以外的选项）并继续；C) 降级为只读模式并记录日志
- 阶段性阶段摘要：每阶段完成后输出摘要文本，附带证据路径

## Wave 1 Detailed Execution Plan (Expanded)
- Task 1: Foundation & Plan alignment
  - Description: Establish plan structure, define TDD approach, test matrix, naming conventions, and guardrails document. Include sample acceptance criteria for Task 3 as a starting point.
  - Depends On: None
  - Parallelization: YES (can start immediately with other independent drafts)
  - Acceptance Criteria:
    - [ ] TDD approach documented with unit/integration/QA test templates
    - [ ] Data dictionary naming conventions defined
    - [ ] Guardrails (deterministic acceptance criteria) defined for downstream tasks
    - [ ] Sample AC for Task 3 (data model) included
  - QA Scenarios:
    - Happy Path: Plan document contains all required sections and is referenceable by downstream tasks
    - Edge Case: Missing section triggers a clear remediation step
  - Skills: librarian, explore

- Task 2: DSM LAN + MariaDB availability
  - Description: Verify network reachability to MariaDB on Synology DSM 7.3 LAN; confirm volume mounts and credentials handling guidance.
  - Depends On: Task 1
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] MariaDB accessible via LAN address (e.g., 192.168.x.x:3306) from the development network
    - [ ] DSM shared volumes for data/attachments exist with proper permissions
    - [ ] Credentials handling strategy documented (prefer vault; avoid plaintext)
    - [ ] Rollback plan documented
  - QA Scenarios:
    - Happy Path: Connectivity test passes; volumes are writable; credentials retrieval path works
    - Edge Case: DB unreachable; plan documents fallback behavior
  - Skills: librarian

- Task 3: Data model design (MariaDB schema)
  - Description: Draft core schema for Users, Roles, Sessions, Records, Attachments, Audit; include ERD and initial DDL.
  - Depends On: Task 2
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] ERD exported (PNG/SVG) and textual data dictionary
    - [ ] DDL for all tables including PK/FK/indices
    - [ ] Relationships mapped to API/data contract
  - QA Scenarios:
    - Happy Path: All tables created with correct relationships
    - Edge Case: Missing FK causes orphaned relation checks
  - Skills: librarian, explore

- Task 4: API design & contracts (Express endpoints)
  - Description: Draft REST API contracts for auth, users, records, attachments; define request/response schemas and error handling.
  - Depends On: Task 3
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] OpenAPI (or equivalent) spec covering core endpoints
    - [ ] Data-model-to-API mapping documented
    - [ ] Validation and error handling strategy defined
  - QA Scenarios:
    - Happy Path: Valid requests yield expected responses
    - Edge Case: Invalid payload returns proper error with 4xx codes
  - Skills: librarian, explore

- Task 5: Attachments storage strategy
  - Description: Define storage layout, per-type size limits, virus scanning hook plan, metadata, and API integration.
  - Depends On: Task 4, Task 3
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] Storage path and permissions defined
    - [ ] Per-type size limits documented (e.g., images 5-10MB, docs 20MB)
    - [ ] Virus scanning hook plan described and integrated points identified
    - [ ] Attachments metadata schema aligned to Task 3
  - QA Scenarios:
    - Happy Path: Upload a valid file succeeds and metadata is stored
    - Edge Case: Oversized file triggers proper error handling
  - Skills: librarian

- Task 6: Authentication flow design (email verification, reset)
  - Description: Define authentication state machine, token lifecycles, and email verification process.
  - Depends On: Task 4
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] State machine diagram covering register, verify, login, refresh, reset
    - [ ] Token expiry/rotation lifecycle documented
    - [ ] Email verification flow defined and mapped to endpoints
    - [ ] MVP decision on SMS support and toggle mechanism
  - QA Scenarios:
    - Happy Path: User registers, verifies email, logs in, can reset password
    - Edge Case: Expired/invalid token handling
  - Skills: librarian, explore

- Task 7: Frontend Electron UI skeleton (login/register/records)
  - Description: Create a minimal Electron UI scaffold; wire to API; secure token storage basics.
  - Depends On: Task 4, Task 6
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] Electron app boots and shows main window
    - [ ] Screens for Login, Register, Create Record exist
    - [ ] API calls wired to Task 4; auth token stored securely in app
  - QA Scenarios:
    - Happy Path: Login works with mock API, token stored securely
    - Edge Case: Network error displays proper message and remains responsive
  - Skills: frontend-ui-ux, playwright

- Task 8: Security baseline, logging, and audit
  - Description: Define RBAC, password hashing, session policy; plan logging/monitoring
  - Depends On: Task 6, Task 7
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] RBAC model documented; roles/permissions mapped
    - [ ] Password hashing implemented in design (and reference to bcrypt/scrypt)
    - [ ] Logging strategy with rotation and privacy considerations
    - [ ] Security verification checklist prepared
  - QA Scenarios:
    - Happy Path: Authentication flows tested with RBAC constraints
    - Edge Case: Privilege escalation attempt denied with proper log
  - Skills: librarian, explore

- Task 9: MVP testing plan (data management, rollback)
  - Description: Create a test plan with unit/integration/e2e tests; define data management, rollback, CI considerations
  - Depends On: Task 7, Task 8, Task 4
  - Parallelization: YES
  - Acceptance Criteria:
    - [ ] Complete test plan including happy-path and edge-case scenarios
    - [ ] Data fixtures and data generation script defined
    - [ ] Rollback/Recovery checks integrated into tests
    - [ ] CI integration plan for test execution
  - QA Scenarios:
    - Happy Path: All tests pass in CI environment with mock data
    - Edge Case: DB outage scenario and rollback path tested
  - Skills: librarian, playwright

Notes:
- Wave 1 任务之间的依赖已明确，后续将把 Wave 1 细化为可执行的提交单元并逐条写入计划/文档中。
- 该扩展计划仅用于评审与授权，不包含代码实现或环境部署变更。


### Dependency Matrix
（待后续填写具体的依赖关系矩阵）

### Agent Dispatch Summary
（在后续阶段根据选择的技术栈与实现细化）

## TODOs
- [ ] 1. 选择技术栈（前端框架/桌面封装工具、后端语言、API 风格）
- [ ] 2. 数据库模型设计草案（用户、角色、认证、记录、附件、会话等）
- [ ] 3. 计划部署架构草图（Synology DSM、Container Manager、MariaDB、文件卷映射）
- [ ] 4. 身份认证与授权设计（登录入口、切换入口、忘记密码流程）
- [ ] 5. 文件上传与存储策略（目录结构、权限、文件类型校验、大小限制）
- [ ] 6. MVP 的 API 设计与接口草案
- [ ] 7. 测试计划与 CI/CD 初步方案
- [ ] 8. 风险与合规性评估
- [ ] 9. 与 Metis/Oracle 的对齐与 guardrails 集成

- Final Verification Wave（最终验证波次）
- F1. Plan Compliance Audit — oracle
- F2. Code Quality Review — unspecified-high
- F3. Real Manual QA — unspecified-high
- F4. Scope Fidelity Check — deep

## 参考与文献
- 该计划为初版草案，后续将依据需求确认的技术栈与具体实现路径进行迭代更新。
