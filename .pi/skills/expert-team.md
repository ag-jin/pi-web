# expert-team(专家团队)

本仓库的专家团队功能:一个主 agent 编排多个专家 subagent 完成任务。专家只回主 agent,不对用户说话;主 agent 是唯一交互者。

## 触发协议(每次新任务必走)

1. **先 consult flow-router**:新任务进来(用户请求、bug 报告、外来 issue),先用 `subagent_consult` 调 flow-router,任务里附上仓库状态摘要(分支、未提交变更数、相关票/文件),让它判定流程、排专家、给闸门。
   - 调用参数:`agentScope: "both"`, `confirmProjectAgents: false`(本仓库已信任)。
2. **按 router 计划执行**:阶段序列不可跳;每阶段产物落盘 `.scratch/<feature>/`;过闸门再进下一阶段。
3. **gate 不过不前进**:闸门是质量底线,不是建议。

## 调用方式选择

| 方式 | 用在哪 |
|---|---|
| `subagent_consult` | 只读判断类:flow-router、griller、spec-reviewer、内置 scout |
| `subagent`(blocking) | 需要结果的委托:spec-writer、ticket-splitter、implementer、bug-hunter |
| `subagent_spawn`(后台) | 当前响应不依赖其结果:researcher、handoff-writer、并行独立审查 |

## 专家名册(位于 `.pi/agents/`)

| agent | 职责 | 调用 |
|---|---|---|
| flow-router | 核心专家:判流程、排专家 | consult |
| griller | 访谈打磨,产问题清单 | consult |
| spec-writer | 线程 → spec | blocking |
| ticket-splitter | spec → 票 + blocking edges | blocking |
| implementer | 单票 TDD 实现 | blocking |
| spec-reviewer | 双轴审查(标准+spec) | consult / spawn |
| bug-hunter | 难缠 bug:先反馈环再修 | blocking |
| researcher | 主源调研带引用 | spawn |
| triager | 外来 issue → agent-ready | blocking |
| handoff-writer | 会话 → 交接文档 | spawn |
| domain-modeler | 词汇审计、ADR 候选 | consult |
| architecture-scout | 架构勘察,deepening 候选 | consult |
| module-designer | 模块形状设计 | consult |

完整名册(工具、模型)见 `.pi/agents/README.md`。

## 执行纪律

- **文件即记忆**:团队知识活在磁盘(CONTEXT.md、ADR、spec、票、research 笔记),不在对话里。
- **术语纪律**:GUI 相关术语用 CONTEXT.md 词汇,不用避免词。
- **git 纪律**:不 add -A、不 reset/stash/checkout;提交只 stage 自己改的文件。
- **他人变更隔离**:任务里标注的他人改动文件一律不碰。
- **成本纪律**:侦察/判断用 flash(flow-router、griller、triager);实现用 deepseek-v4-flash;审查用 gpt-5.6-terra(异源,xhigh);调研/规格用 flash。并行上限 8 任务/4 并发(blocking),stateful 10 活跃。
- **上下文卫生**:implementer 每张票一个全新上下文;主 agent 只保留决策上下文,细节外置文件。

## 验证与维护

- 检查名册:`subagent_inspect list_agents`(agentScope: both)
- 新 agent 生效:无需 reload,立即发现(已实测)
- 修改 agent 提示词:直接编辑 `.pi/agents/*.md`,下次调用生效
- 环境要求(用户级,不进仓库):`pi-subagents` 扩展已装;`~/.pi/agent/pi-subagents.json` 设 `stateful.maxActiveTurns=10`;仓库已信任
