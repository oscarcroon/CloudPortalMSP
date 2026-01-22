import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const layersDir = path.join(root, 'layers')
const forbidden = [
  { key: '.card', description: 'generic card class (use mod-<module>-*)', regex: /\.card\b(?!-)/ },
  { key: '.btn', description: 'generic button class (use mod-<module>-*)', regex: /\.btn\b(?!-)/ },
  { key: '.title', description: 'generic title class (use mod-<module>-*)', regex: /\.title\b(?!-)/ }
]

type Finding = { file: string; line: number; match: string; description: string }

async function collectCssFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules if ever present inside a layer
      if (entry.name === 'node_modules') continue
      files.push(...(await collectCssFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(full)
    }
  }

  return files
}

async function analyzeFile(file: string): Promise<Finding[]> {
  const content = await readFile(file, 'utf8')
  const findings: Finding[] = []
  const lines = content.split('\n')

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    // Skip obvious Tailwind @apply lines that already use mod- prefix
    if (line.includes('mod-')) return
    for (const rule of forbidden) {
      if (rule.regex.test(line)) {
        findings.push({
          file,
          line: lineNumber,
          match: rule.key,
          description: rule.description
        })
      }
    }
  })

  return findings
}

async function main() {
  const exists = await stat(layersDir).then(() => true).catch(() => false)
  if (!exists) {
    console.error('layers/ directory not found; run from frontend root')
    process.exit(1)
  }

  const cssFiles = await collectCssFiles(layersDir)
  const allFindings: Finding[] = []

  for (const file of cssFiles) {
    const findings = await analyzeFile(file)
    allFindings.push(...findings)
  }

  if (allFindings.length === 0) {
    console.log('✔ plugin CSS check passed (no forbidden generic class names found)')
    return
  }

  console.error('✖ Found forbidden generic class names in plugin CSS:')
  for (const finding of allFindings) {
    console.error(
      `  ${path.relative(root, finding.file)}:${finding.line} -> ${finding.match} (${finding.description})`
    )
  }
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


