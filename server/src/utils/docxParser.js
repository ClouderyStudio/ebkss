import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARSE_SCRIPT = join(__dirname, '..', '..', 'scripts', 'parse-docx.py');
const TMP_DIR = join(__dirname, '..', '..', 'tmp');

/**
 * 使用 Python 解析 .docx 文件，返回文本行数组。
 * @param {Buffer} docxBuffer - .docx 文件的二进制内容
 * @returns {Promise<string[]>}
 */
export async function parseDocx(docxBuffer) {
  // 确保 tmp 目录存在
  const { mkdir } = await import('node:fs/promises');
  await mkdir(TMP_DIR, { recursive: true });

  // 写入临时文件
  const tmpFile = join(TMP_DIR, `import_${crypto.randomUUID()}.docx`);
  await writeFile(tmpFile, docxBuffer);

  try {
    const text = await new Promise((resolve, reject) => {
      execFile('python', [PARSE_SCRIPT, tmpFile], {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Python parse-docx failed: ${stderr || error.message}`));
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.lines);
          }
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 200)}`));
        }
      });
    });

    return text;
  } finally {
    // 清理临时文件
    await unlink(tmpFile).catch(() => {});
  }
}
