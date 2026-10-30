# SimplePrompt v1.6

面向新手的中英双语提示词工具，支持画师浏览、收藏、黑名单与多模型输出。

[在线使用](https://alexzba.github.io/SimplePrompt/)

当前包含 76 位画师、304 张本地预览图与 3741 个双语标签。画师预览图片随程序打包，网页打开后从同站点的 assets/artist-images 加载，不依赖外部图站或 Python 服务。

## 离线使用

下载并解压完整目录，保留 css、js、data、assets，再双击 index.html。不要只下载 HTML 文件。

## GitHub Pages

将 index.html、css、js、data、assets 和 .nojekyll 保持在同一发布根目录。图片路径使用相对路径，可用于 /SimplePrompt/ 项目子路径。已启用的 Pages 部署会在 main 更新后发布。

## 标签和图片来源

普通标签参考 Latent Tags / Danbooru。画师风格标签是根据作品介绍、访谈和评论作出的编辑归纳，不保证每幅作品都符合。来源记录见 docs/data-sources.json 和 docs/style-tag-research.json。

新增预览按来源元数据筛选，未全部逐图视觉审核。第三方作品版权归原作者，不属于 MIT 代码许可的授权范围。删除请求请通过仓库 Issues 联系维护者。

## 许可

代码采用 MIT 许可证，版权归 AlexZBA。项目使用 ChatGPT 辅助编程。原有功能、收藏和黑名单逻辑沿用 v1.6。
