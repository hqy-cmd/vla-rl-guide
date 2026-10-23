# VLA + 强化学习 · 学习指南配套交互图

在线访问：<https://hqy-cmd.github.io/vla-rl-guide/>

配合「VLA + 强化学习」学习指南 PPT 自学用的 4 个交互网页，以 π0.7 为例：

| 页面 | 内容 | 所用库 |
|---|---|---|
| [图 1 图像怎样变成 token](https://hqy-cmd.github.io/vla-rl-guide/w1_patch_embedding.html) | 图像切块、提特征、投影成向量 | TensorSpace / three.js |
| [图 4 从噪声出发，走向两种可行动作](https://hqy-cmd.github.io/vla-rl-guide/w4_flow_matching.html) | flow matching 去噪与速度场 | three.js / D3 |
| [图 5 动作接着执行，推理同时进行](https://hqy-cmd.github.io/vla-rl-guide/w5_action_chunk_rtc.html) | 动作块、同步 / 朴素异步 / RTC 式交接 | D3 |
| [图 6 离成功还差多远，这一段走得怎样](https://hqy-cmd.github.io/vla-rl-guide/w6_value_advantage.html) | 价值、优势与训练标签 | D3 |

## 说明

- 图中数据为示意，用来说明机制；标注页码的参数取自原文，出处见各页脚注。
- 参考文献：
  [1] Physical Intelligence et al., "π0.7: a Steerable Generalist Robotic Foundation Model with Emergent Capabilities", arXiv:2604.15483v2.
  [2] Physical Intelligence et al., "π\*0.6: a VLA That Learns From Experience", arXiv:2511.14759v2.
- 纯静态页面，所有脚本和字体都在 `vendor/`，不请求外部资源。下载仓库后直接双击 `index.html` 也可离线打开。
- 国内网络访问 github.io 可能不稳定，打不开时可下载本仓库（Code → Download ZIP）离线使用。

## 第三方资源

- D3 v7（ISC）、three.js（MIT）、TensorSpace（Apache-2.0）、TensorFlow.js（Apache-2.0）、tween.js（MIT）。
- 字体：Noto Serif / Sans CJK SC、Source Serif、Source Sans，均为 SIL Open Font License 1.1，已按页面用字子集化，许可文本见 `vendor/fonts/OFL-*.txt`。
