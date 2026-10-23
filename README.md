# VLA + 强化学习入门

用短文案和交互演示拆开 VLA 的“看、想、动”，逐步理解 π0.7 与强化学习。目前完成新版第 3 批：第 1 关两种 3D 任务；第 2 关相机画面切块与 token 队列；第 3 关动作块的等待、直接切换和 RTC 近似；第 4 关双峰 flow matching 采样。前四关均有对应画面的本地缩略图，其余关卡制作中。

线上地址：<https://hqy-cmd.github.io/vla-rl-guide/>。旧版交互图保存在 [v3/](v3/index.html)，原来的四个页面链接仍可跳转，保留锚点。

本地开发（Node.js 22.12+，建议当前 LTS）：

```sh
cd site-src
npm i
npm run dev
npm run check
npm run deploy:local
```

`npm run build` 检查文案并生成 `site-src/dist/`。`npm run deploy:local` 再将产物复制到根目录，生成仓库旁的 `vla-rl-guide-offline.zip`，不执行 Git 提交或推送。解压后双击 `index.html` 即可离线打开，也可直接双击仓库根目录的 `index.html`。

源码为 Vite + 原生 JS，JSON 文案在 `site-src/content/`，构建时打包进一个普通 IIFE 脚本。字体与资源均在本地，生产 CSP 沿用指定策略，无需额外放宽。开发服务器仅为 Vite 热更新额外允许本机 WebSocket，不进入生产产物。进度存于 `vla-guide:done`；存储不可用时仅在当前页面内保留。前四关均在运行结束时记录进度；第 4 关单独点击取平均不计入完成。舞台通过 `mount(levelId, container)`、`unmount()`、`getAnchors()`、`onControl(id, value)` 对接，3D 模块另提供 `project()` 和按帧订阅，控件事件经过 `src/bus.js`。

第 1、3、4 关模块导出 `buildThumbScene()`，返回独立拥有资源的 `scene`、`bounds` 和可选 `fitPoints`。第 2 关导出 `drawThumb(ctx)`；其相机帧由第 1 关场景离屏渲染一次后释放资源。第 3、4 关复用桌子、机械臂、解析 IK、轨迹点与按需渲染；缩略图管线生成 PNG 后释放资源。共享零件与解析 IK 在 `site-src/src/stage3d/parts.js`。three.js r186 已移除 PCFSoftShadowMap，本版使用受支持的 PCFShadowMap 滤波路径。WebGL 不可用时改用 Canvas 平面图，四关交互仍可运行。

可重复浏览器验收：`cd site-src && npm run test:acceptance`；第 1 关 3D 与任务专项为 `npm run test:b2`，第 2–4 关专项为 `npm run test:b3`（先 `npm run deploy:local`）。数学测试可单独执行 `node src/levels/flow-math.test.js`。需要本机 Google Chrome 或设置 `CHROME_PATH`；截图与验收报告写入仓库旁的 `vla-rl-guide-shots/`。

第 4 关采用等权双峰高斯玩具分布，中心为 `(−1.5, 1)` / `(1.5, 1)`，`σ = 0.15`。`src/levels/flow-math.js` 给出线性路径、解析 GMM 后验条件速度与 Euler 更新。单元测试使用三组固定种子、每组 10,000 点，检查 20 步结果超过 90% 位于任一峰的欧氏半径 `2σ` 内。1 步 Euler 的结果严格退化为两峰均值，所以该步数下高亮轨迹也会撞到障碍并停住；不对落点做避障投影或重新采样。

字体采用 SIL Open Font License（OFL）：Barlow、Barlow Semi Condensed、JetBrains Mono、Noto Sans CJK（中文使用 Noto Sans SC 子集）。许可证保存在 `fonts/OFL-*.txt`；旧版字体许可证在 `v3/vendor/fonts/`。

版式参考：[learn-arduino-red.vercel.app](https://learn-arduino-red.vercel.app/)（Dilum Sanjaya）。本站图标、布局实现与样式独立编写。
