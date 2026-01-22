import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

type ReplaceMap = Record<string, string>

function toTitleCase(moduleKey: string) {
  return moduleKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

async function exists(p: string) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

async function replaceInFile(file: string, replaceMap: ReplaceMap) {
  const content = await readFile(file, 'utf8')
  let updated = content
  for (const [from, to] of Object.entries(replaceMap)) {
    updated = updated.split(from).join(to)
  }
  if (updated !== content) {
    await writeFile(file, updated, 'utf8')
  }
}

async function main() {
  const [, , moduleKey] = process.argv
  if (!moduleKey) {
    console.error('Usage: npm run scaffold:plugin <module-key>')
    process.exit(1)
  }

  const root = process.cwd()
  const templateDir = path.join(root, 'layers', 'plugin-template')
  const targetDir = path.join(root, 'layers', moduleKey)

  const templateExists = await exists(templateDir)
  if (!templateExists) {
    console.error('plugin-template saknas i layers/.')
    process.exit(1)
  }

  const alreadyExists = await exists(targetDir)
  if (alreadyExists) {
    console.error(`Målmapp finns redan: ${path.relative(root, targetDir)}`)
    process.exit(1)
  }

  await ensureDir(targetDir)
  await cp(templateDir, targetDir, { recursive: true })

  // Rename page directory and CSS file
  const templatePageDir = path.join(targetDir, 'pages', 'example-module')
  const targetPageDir = path.join(targetDir, 'pages', moduleKey)
  if (await exists(templatePageDir)) {
    await rename(templatePageDir, targetPageDir)
  }

  const templateCss = path.join(targetDir, 'assets', 'css', 'example-module.css')
  const targetCss = path.join(targetDir, 'assets', 'css', `${moduleKey}.css`)
  if (await exists(templateCss)) {
    await rename(templateCss, targetCss)
  }

  const title = toTitleCase(moduleKey)
  const replaceMap: ReplaceMap = {
    'example-module': moduleKey,
    'Example Module': title,
    '@example-module': `@${moduleKey}`,
    'example:read': `${moduleKey}:read`,
    'example:write': `${moduleKey}:write`
  }

  const files = await walkFiles(targetDir)
  for (const file of files) {
    await replaceInFile(file, replaceMap)
  }

  console.log('✔ Plugin scaffold klar:')
  console.log(`  - Kopierat plugin-template till layers/${moduleKey}`)
  console.log(`  - Uppdatera layers/plugin-manifests.ts med import + export för ${moduleKey}`)
  console.log('  - Kör npm run generate:rbac-types')
  console.log('  - Justera permissions/roller i manifestet efter behov')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


