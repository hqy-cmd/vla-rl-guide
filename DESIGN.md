# web_v3 设计规范（DESIGN.md）

适用范围：`index.html`、`w1_patch_embedding.html`、`w4_flow_matching.html`、`w5_action_chunk_rtc.html`、`w6_value_advantage.html`。
目标：读起来像一篇学术出版物里的交互图（参考 Distill.pub、期刊排版），不像 SaaS 仪表盘。
保留：v2（`../web/`）的全部交互、计算逻辑、数据、出处页码和简化说明。本次只改视觉和排版；文字可以精简，事实不变。

---

## 0. v2 的问题（要去掉的东西）

- 圆角卡片堆叠（控件卡、主图卡、右侧卡，三层白卡片 + 阴影）。
- 胶囊按钮、深藏青实心按钮、"示意数据"药丸徽章。
- 右侧大号彩色百分比/坐标数字，像 KPI 面板。
- 青绿 + 橙 + 珊瑚红的高饱和组合，每页各用各的。
- 小号灰字堆在控件下面当说明。
- 3D 场景里的高饱和点云、粗流线。
- 一律禁止：深色底、渐变、霓虹、发光、阴影（box-shadow / text-shadow）、圆角 > 3px、emoji、图标字体、彩虹配色。

## 1. 颜色

| Token | 值 | 用途 |
|---|---|---|
| `--paper` | `#FAF8F3` | 页面底色（暖米白） |
| `--paper-2` | `#F3F0E8` | 图区底色，3D 场景背景，悬停底 |
| `--ink` | `#1C1B19` | 标题、正文 |
| `--ink-2` | `#4A4740` | 次要正文、图注 |
| `--ink-3` | `#7D786E` | 旁注、脚注、坐标轴文字 |
| `--rule` | `#D6D0C2` | 细线分隔、坐标轴、控件轨道 |
| `--rule-2` | `#E6E1D5` | 网格线、更弱的分隔 |
| `--accent` | `#1F5F7A` | 全套唯一强调色（深青）：滑块手柄、当前选中、链接、关键读数 |
| `--accent-tint` | `#E1EAEC` | 强调色浅底（选中项、高亮区间） |

数据类别色（色盲友好、低饱和，四页统一含义）：

| Token | 值 | 固定含义 |
|---|---|---|
| `--c-blue` | `#3D7396` | 类别 A：左绕 / 同步执行 / 正标签 |
| `--c-ochre` | `#C08A3E` | 类别 B：右绕 / 朴素异步 |
| `--c-brick` | `#A9553F` | 警示：障碍、直接回归落点、人工接管、出错 |
| `--c-sage` | `#6E8B5B` | 类别 C：RTC 式 |
| `--c-gray` | `#A29D92` | 其余 / 未选中 / 背景样本 |

- 同一页最多同时出现 4 种数据色；强调色 `--accent` 不兼做数据色以外的装饰。
- 区分类别时同时用线型/形状（实线/虚线、实心/空心），不能只靠颜色。
- 透明度用于密集样本（0.25–0.5），不用渐变。

## 2. 字体

文件已放在 `vendor/fonts/`（子集化 woff2，不要改文件名）：

```
NotoSerifSC-Regular.woff2  NotoSerifSC-Bold.woff2      # 中文衬线（标题）
NotoSansSC-Regular.woff2   NotoSansSC-Bold.woff2       # 中文无衬线（正文）
SourceSerif-Regular.woff2  SourceSerif-Semibold.woff2  SourceSerif-It.woff2   # 英文/数字衬线
SourceSans-Regular.woff2   SourceSans-Semibold.woff2   # 英文/数字无衬线
```

@font-face 族名：`"GuideSerifLatin"`(Source Serif)、`"GuideSerifSC"`(Noto Serif SC)、`"GuideSansLatin"`(Source Sans)、`"GuideSansSC"`(Noto Sans SC)；Bold 文件对应 `font-weight:700`，Semibold 对应 600；`font-display: swap`。

```css
--serif: "GuideSerifLatin","GuideSerifSC","Noto Serif SC","Source Han Serif SC","Songti SC","STSong",serif;
--sans:  "GuideSansLatin","GuideSansSC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;
```

拉丁字体在前，中文字体在后：英文和数字用 Source，中文落到 Noto。最终发布前会按页面实际用字重新子集化，所以字体文件名和族名必须保持不变。

## 3. 字号层级（1280–1440 宽屏）

| 层级 | 字体 | 字号/行高 | 字重 | 颜色 |
|---|---|---|---|---|
| 页眉小标（"VLA + 强化学习 · 交互图 4"） | sans | 12.5/1.4，`letter-spacing:.06em` | 400 | `--ink-3` |
| 页面标题 | serif | 30/1.3 | 700 | `--ink` |
| 导语（一句话） | serif | 17/1.6 | 400 | `--ink-2` |
| 小节标题（旁注栏、图注标题） | serif | 15/1.5 | 700 | `--ink` |
| 正文 | sans | 15/1.75 | 400 | `--ink` |
| 图注 | sans | 13.5/1.65 | 400 | `--ink-2` |
| 控件标签 | sans | 13/1.4 | 400 | `--ink-2`；当前值用 `--ink` + `font-variant-numeric: tabular-nums` |
| 坐标轴/刻度/图内标注 | sans | 12/1.3 | 400 | `--ink-3`（图内标注与所指对象同色时用对应数据色） |
| 脚注、旁注、来源 | sans | 12/1.6 | 400 | `--ink-3` |
| 关键读数（旁注栏里的数） | serif | 22/1.2 | 400 | `--ink`（不要用强调色大数字） |

- 正文和图注栏宽 ≤ 38em（约 640px）。
- 中文不用斜体；英文变量名可用 Source Serif Italic（如 *x*、*t*、*H*）。
- 数字统一 `tabular-nums`。

## 4. 版式

- 页面底色 `--paper`，无卡片。区块之间用 1px `--rule` 细线或留白分隔。
- 容器：`max-width: 1180px; margin: 0 auto; padding: 32px 48px 56px`。
- 结构（自上而下）：
  1. 页眉：小标 → 标题 → 导语，下面一条 1px `--rule`。右上角放一个回目录的文字链接"← 目录"（12.5px，`--ink-3`）。
  2. 控件条：一行排开，组之间用竖向 1px `--rule-2` 分隔，无底色、无边框盒。
  3. 图区（Figure）：左侧主图约 66%，右侧旁注栏约 30%（左边一条 1px `--rule` 竖线，padding-left 24px）。主图区本身可以用 `--paper-2` 底，不加边框、不加圆角。
  4. 图注：主图正下方，格式 **"图 4　从噪声出发，走向两种可行动作。"**（serif 粗体的编号和标题句）+ 后续 sans 说明 1–3 句。多面板时用 (a)(b)(c) 标注面板。
  5. 脚注区：顶部 1px `--rule`，包含"示意数据"说明、简化说明、参考文献（编号列表，含 arXiv 号和页码）。
- 首屏要求：1280×720 视口下，页眉 + 控件 + 主图的主体在首屏可见；图注、脚注可以在下方，靠滚动查看。1440×900 下主图完整可见。
- 间距基准 8px；区块之间 32–40px；不要把文字塞进图里补空。

## 5. 控件（细线风）

- 滑块：自绘 `input[type=range]`。轨道 1px `--rule`（已走过部分 2px `--accent`）；手柄 12px 实心圆 `--accent`，无阴影；聚焦时 2px `--accent` 外描边（`outline-offset:2px`）。
- 按钮：透明底，1px `--ink-3` 描边，`border-radius:2px`，13px sans，padding 4px 12px；悬停底 `--paper-2`；主操作（播放/重新采样）只多一个 `--accent` 文字色，不用实心填充。
- 分段选择（预设、补丁大小）：文字 + 下划线，当前项 `--ink` + 2px `--accent` 下划线，其余 `--ink-3`。
- 下拉框：无框，仅 1px `--rule` 下边线，自绘细箭头。
- 复选框：原生 + `accent-color: var(--accent)`。
- 控件标签在左、当前值在右或紧跟其后（"去噪步数　5"），说明性小字（"π0.7 推理用 5 步，p7"）改为旁注栏或图注里的一句，不堆在控件下面。

## 6. 图表

- 2D（D3）：坐标轴 1px `--rule`，刻度文字 `--ink-3` 12px，刻度线朝外 4px；网格线可选，用 `--rule-2`、0.5–1px。去掉图框。
- 线宽：主数据 1.75–2px，参考线 1px 虚线 `--ink-3`。
- 直接标注优先于图例：在曲线末端或区域旁用同色小字标名称；只有确实放不下时才用图例（行内文字 + 小色块，放在图注里）。
- 悬停：细竖线 `--ink-3` + 小号读数，不用浮动卡片阴影；如需提示框，`--paper` 底 + 1px `--rule` 边 + 12px 字。
- 高亮区间：`--accent-tint` 或对应数据色 12–18% 透明度的平涂。
- 时间轴分段标签（W6"接近目标/失误后恢复…"）：用细刻度 + 文字，不用彩色色块条。
- 3D（three.js / TensorSpace）：
  - 背景 `--paper-2`（`#F3F0E8`），雾化可选，不用黑底。
  - 网格 `--rule-2`，坐标轴 `--rule`/`--ink-3`。
  - 材质：`MeshBasicMaterial`/`LineBasicMaterial` 为主，平涂，不用高光、发光、环境贴图。
  - 点：小尺寸（屏幕上约 3–4px），类别色；流线 1px，透明度 0.25–0.35。
  - 障碍物（W4）：`--c-brick` 细线框 + 15% 透明平涂，图内标注"障碍物"。
  - 文字标注用 HTML 覆盖层（sans 12px，`--ink-3` 或对应数据色），不要用 3D 文字精灵。
  - TensorSpace（W1）：把场景背景色设为 `#F3F0E8`，层颜色改为低饱和（输入层保持图像本色；卷积/投影层用 `--c-blue` 系，必要时查 `vendor/tensorspace.min.js` 支持的 `color` 配置项）。

## 7. 示意数据与出处

- 去掉"示意数据"药丸徽章。改为：
  - 标题行末或图注中加上标 † ，例如"图 6　离成功还差多远†"；
  - 脚注："† 本图数据为示意，用来说明机制。标注页码的参数取自原文。"
- 原文参数在旁注栏或图注里写成"π0.7 推理用 5 步去噪 [1, p.7]"；参考文献在脚注区编号列出：
  - [1] Physical Intelligence et al., "π0.7: a Steerable Generalist Robotic Foundation Model with Emergent Capabilities", arXiv:2604.15483v2.
  - [2] Physical Intelligence et al., "π\*0.6: a VLA That Learns From Experience", arXiv:2511.14759v2.
  - 页码沿用 v2 页面里已有的标注（v2 写的"π0.7 p7"即 [1, p.7]），不新增引用。
- 示意的设定值（如 W5 的 H 范围 40–80、W6 的失败惩罚 −330）在旁注里写"示意设定"。
- 简化说明：放在脚注区，小节标题"简化说明"，1–3 句。

## 8. 文字规则

- 中文短句，直接说事。不用填充词和套话（"值得注意的是""让我们""本质上""深入""赋能"等），不用 emoji。
- 不使用"不是 X 而是 Y"/"不是……，而是……"句式。
- 不新增数字、图、引用；只改写 v2 已有的文字。推断性内容沿用 v2 的标注。

## 9. index.html（目录页）

- 同一套样式。页眉：小标"VLA + 强化学习 · 学习指南配套"，标题"交互图"，导语一句说明用途（配合 PPT 自学，用鼠标拖动看机制）。
- 正文：按学习顺序列出四项（W1 → W4 → W5 → W6），每项一行：
  `图 1　图像怎样变成 token`（serif 链接，`--ink`，悬停 `--accent` 下划线）＋ 一句话说明（sans 14px `--ink-2`）＋ 右侧小字"TensorSpace / three.js / D3"（`--ink-3`）。
  项与项之间 1px `--rule-2` 细线。可选：每项左侧放一张小缩略图（若做，用 `screenshots/` 里的 PNG，宽 160px，1px `--rule` 边框）。
- 脚注：说明示意数据规则、离线可用、参考文献 [1][2]。
- 每个子页面右上角"← 目录"链接回 `index.html`。

## 10. 技术约束（不变）

- 每页单个 HTML；只允许引用 `vendor/` 下的本地文件（JS、字体、可选共享样式 `vendor/guide.css`）；不引用任何 CDN 或外部 URL。
- `file://` 直接打开可用，控制台无 error，无外部网络请求，页面就绪后设置 `window.__ready = true`。
- 保留 v2 的所有交互和计算（W4 解析速度场、W5 三行时序、W6 价值/优势/阈值、W1 TensorSpace 模型与 base64 内嵌 shim）。
