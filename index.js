import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'office-fill-tool'
export const inject = ['tools']

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const EXE_PATH = path.join(ROOT, 'bin', 'office fill tool.exe')

function assertWindows() {
  if (process.platform !== 'win32') {
    throw new Error('office fill tool 目前只提供 Windows 可执行文件。')
  }
  if (!existsSync(EXE_PATH)) {
    throw new Error(`找不到程序文件：${EXE_PATH}`)
  }
}

/**
 * 调用 exe 的无界面 CLI 模式：
 *   --cli --mode excel|word --template ... --data ... --output ... --result-file ...
 * CLI 会把结果 JSON 写到 result-file，再由这里读回。
 */
async function runCli({ mode, template, data, outputDir, signal }) {
  await mkdir(outputDir, { recursive: true })
  const resultFile = path.join(outputDir, `.office-fill-result-${randomUUID()}.json`)
  let stderr = ''
  let exitCode
  try {
    exitCode = await new Promise((resolve, reject) => {
      let child
      try {
        child = spawn(EXE_PATH, [
          '--cli',
          '--mode', mode,
          '--template', template,
          '--data', data,
          '--output', outputDir,
          '--result-file', resultFile,
        ], {
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        })
      } catch (error) {
        reject(error)
        return
      }

      const onAbort = () => {
        try {
          child.kill()
        } catch {
          /* ignore */
        }
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.once('error', (error) => {
        signal?.removeEventListener('abort', onAbort)
        reject(new Error(`启动生成器失败：${error.message}`))
      })
      child.once('close', (code) => {
        signal?.removeEventListener('abort', onAbort)
        resolve(code)
      })
    })

    if (signal?.aborted) {
      throw new Error('生成已取消')
    }

    // Windows 上文件落盘可能比进程退出略晚，短暂重试后再读
    let text = ''
    let lastError
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        text = await readFile(resultFile, 'utf8')
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    if (lastError) {
      throw new Error(
        `生成器没有返回结果（退出码 ${exitCode}${stderr ? `，stderr：${stderr.slice(-500)}` : ''}）`,
      )
    }

    const result = JSON.parse(text)
    if (!result.ok) {
      throw new Error(result.error || '生成失败')
    }
    return result
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    try {
      await unlink(resultFile)
    } catch {
      /* ignore */
    }
  }
}

function launchGui() {
  return new Promise((resolve, reject) => {
    const child = spawn(EXE_PATH, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'batch_generate_files',
    description: '根据 Office 模板和数据台账批量生成 Excel/Word 文件，返回生成的文件列表。',
    parameters: {
      template: { type: 'string', required: true, description: '模板文件绝对路径（Excel 模式 .xlsx，Word 模式 .docx）' },
      data: { type: 'string', required: true, description: '数据台账 .xlsx 绝对路径' },
      output_dir: { type: 'string', required: true, description: '输出目录绝对路径' },
      mode: { type: 'string', description: 'excel（默认）或 word' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          folder: { type: 'string' },
          count: { type: 'number' },
          files: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
      render: (_args, value) => {
        const lines = [`已生成 ${value.count} 个文件`, `输出目录：${value.folder}`]
        for (const file of value.files) lines.push(`- ${file}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args, exec) {
      assertWindows()
      const mode = String(args.mode || 'excel').toLowerCase()
      if (mode !== 'excel' && mode !== 'word') {
        throw new Error('mode 只能是 excel 或 word。')
      }
      for (const [label, file] of [['模板', args.template], ['数据台账', args.data]]) {
        if (!existsSync(file)) {
          throw new Error(`${label}文件不存在：${file}`)
        }
      }
      const result = await runCli({
        mode,
        template: args.template,
        data: args.data,
        outputDir: args.output_dir,
        signal: exec.signal,
      })
      return {
        folder: result.folder,
        count: result.count,
        files: result.files,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'open_office_fill_tool',
    description: '打开 Office 批量生成器的图形界面（手动选择模板/台账并生成）。仅 Windows 可用。',
    parameters: {
      note: { type: 'string', description: '可选：本次操作说明，仅用于提示。' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      assertWindows()
      await launchGui()
      const suffix = args?.note ? `（${args.note}）` : ''
      return `已打开 Office 批量生成器界面${suffix}。`
    },
  }))
}
