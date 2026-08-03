# 专家团队(Expert Team)

本仓库的 subagent 专家团队功能:一个主 agent + 多个专家 subagent 的星型协作架构。主 agent 是唯一与用户交互者;专家只读、只判断、只执行,通过主 agent 转述与衔接。

## 拓扑

```
用户 ──唯一交互── 主 agent ──consult── flow-router(核心专家:判流程、排专家)
                        ├─ blocking / spawn → 专家(只回主 agent)
                        └─ 执行:产物落 .scratch/,gate 过闸再下一步
```

## 名册

| agent | 职责 | 工具 | 模型 | 调用 |
|---|---|---|---|---|
| flow-router | 判流程、排专家、给闸门 | read, grep, find, ls | deepseek-v4-flash | consult |
| griller | 访谈打磨,产问题清单 | read, grep, find, ls | deepseek-v4-flash | consult |
| spec-writer | 线程 → spec | read, grep, find, ls, write | deepseek-v4-flash | blocking |
| ticket-splitter | spec → 票 + blocking edges | read, grep, find, ls, write | deepseek-v4-flash | blocking |
| implementer | 单票 TDD 实现 | 全套 | deepseek-v4-flash | blocking |
| spec-reviewer | 双轴审查(标准+spec) | read, grep, find, ls, bash | facaiai/gpt-5.6-terra | consult / spawn |
| reviewer-terra | spec-reviewer 的 Terra 显式变体(模型全限定,不受 settings 快照覆盖影响) | read, grep, find, ls, bash | facaiai/gpt-5.6-terra | consult / spawn |
| bug-hunter | 难缠 bug:先反馈环再修 | read, grep, find, ls, bash, write | deepseek-v4-flash | blocking |
| researcher | 主源调研,带引用笔记 | 全套 | deepseek-v4-flash | spawn |
| triager | 外来 issue → agent-ready 票 | read, grep, find, ls, write | deepseek-v4-flash | blocking |
| handoff-writer | 会话 → 交接文档 | read, write | deepseek-v4-flash | spawn |
| domain-modeler | 词汇审计、ADR 候选 | read, grep, find, ls | deepseek-v4-flash | consult |
| architecture-scout | 架构勘察,deepening 候选 | read, grep, find, ls | deepseek-v4-flash | consult |
| module-designer | 模块形状设计(trade-off) | read, grep, find, ls | deepseek-v4-flash | consult |

## 设计依据(实测约束)

- 子进程非交互 → 专家物理上不能对用户说话,主 agent 是唯一交互者
- consult 强制只读(read/grep/find/ls 交集)→ 判断类专家天然安全
- 每任务输出 ≤50KB → 专家输出简报,细节落文件
- 上下文隔离 → 团队记忆 = 磁盘文件,可审计可续接
- 并发:blocking 8 任务/4 并发;stateful 10 活跃(用户级配置)
- 写冲突 guard → 并行任务划清文件边界
- 新 agent 文件无需 reload 即时生效

## 环境要求(用户级,不属于本仓库)

1. `@narumitw/pi-subagents` 扩展已安装
2. `~/.pi/agent/pi-subagents.json`:
   ```json
   { "stateful": { "enabled": true, "maxAgents": 20, "maxActiveTurns": 10 },
     "agents": { "<专家名>": { "model": "<模型ID>" }, ... } }
   ```
   - `stateful.maxActiveTurns=10`:并发上限
   - `agents.<专家名>.model`:模型由配置选择,覆盖 agent 文件 frontmatter 的默认值(支持 tools/thinkingLevel/timeoutMs 覆盖)

3. 仓库信任:项目级 agents 需要信任与 `agentScope: "both"`(`confirmProjectAgents: false`)

## 使用

主 agent 按 `.pi/skills/expert-team.md` 的协议驱动:新任务 → consult flow-router → 按计划调专家 → gate 验收。

## 验证

```bash
# 名册可见性(需在 pi 会话内)
# /subagents 或 subagent_inspect list_agents(agentScope: both)
```

## 维护

- 改提示词:直接编辑本目录 md,下次调用生效
- 加专家:新增 md(frontmatter: name/description/tools/model/thinkingLevel + 正文 system prompt),同步更新本 README 与 expert-team skill
- 提交:显式 `git add .pi/agents/ .pi/skills/expert-team.md`,勿用 -A

## 已知坑(踩过)

- **模型 ID 重名解析**: 若模型与内置 provider 重名(如 gpt-5.6-terra 同时存在于内置 azure-openai-responses 与用户 facaiai),frontmatter/配置里必须写全限定 `provider/id`(如 `facaiai/gpt-5.6-terra`),否则子进程解析到内置无 key provider,报 "No API key found for azure-openai-responses"。
- **settings 快照覆盖**: `~/.pi/agent/pi-subagents.json` 的 `agents.<name>.model` 在**会话启动时快照**,当前会话内修改不生效(需 /reload);且快照值**覆盖 frontmatter**。调试时可用 settings 中不存在的新 agent 名(如 reviewer-terra)绕过。
- **模型可用性必须先验证**: 模型在 `--list-models` 可见 ≠ 子进程可用(provider key 可能缺失)。裸跑验证: `pi --mode json -p --no-session --model <provider/id> -p "Say exactly: ok"`。
