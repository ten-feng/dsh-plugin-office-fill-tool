# dsh-plugin-office-fill-tool

DeepSeek Harness（DSH）插件：根据 Excel/Word 模板和数据台账批量生成文件，并向模型返回生成的文件列表。

## 功能

- `batch_generate_files`：传入 `template`、`data`、`output_dir`、`mode`，后台生成并返回 `folder` / `count` / `files`。
- `open_office_fill_tool`：打开 Windows 图形界面，手动操作。
- 支持 Excel（`.xlsx`）和 Word（`.docx`）模板。
- 保留模板的单元格边框、行级格式、合并单元格等格式。

## 安装

要求：Windows、DSH 版本 `>= 0.2.1-rc.2`。

```powershell
dsh plugin --profile desktop add github:ten-feng/dsh-plugin-office-fill-tool
```

安装后重启 DSH，在插件页应看到 `office fill tool`。

也可以使用本地目录或 tarball 安装：

```powershell
dsh plugin --profile desktop add "C:\path\to\dsh-plugin-office-fill-tool"
dsh plugin --profile desktop add .\dsh-plugin-office-fill-tool-0.2.0.tgz
```

## 使用示例

在 DSH 对话中：

> 用 batch_generate_files 生成文件：
> template = C:\...\模板.xlsx
> data = C:\...\台账.xlsx
> output_dir = C:\...\输出
> mode = excel

返回：

```json
{
  "folder": "C:\\...\\输出\\生成文件_20261025",
  "count": 9,
  "files": ["C:\\...\\A区.xlsx", "C:\\...\\B区.xlsx"]
}
```

## 目录结构

```text
.
├─ package.json
├─ index.js
├─ cordis.patch.yml
├─ README.md
├─ LICENSE
└─ bin/
   ├─ office fill tool.exe
   └─ _internal/
```

## 限制

- 仅 Windows 可用（exe 为 Windows 程序）。
- 生成配置和日志写在 `bin/` 目录。
- 第一次调用时 DSH 需要能执行本机 exe，部分安全软件可能拦截。

## 卸载

```powershell
dsh plugin --profile desktop remove dsh-plugin-office-fill-tool
```
