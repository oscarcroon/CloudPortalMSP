/**
 * Public Operations Generator
 *
 * Scans *.openapi.ts files and generates a static list of public operations.
 * This script is run at build/CI time, NOT at runtime.
 *
 * Usage: npx tsx scripts/generate-public-operations.ts
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, basename, dirname, sep, posix } from 'node:path'
import { pathToFileURL } from 'node:url'

// ============================================================================
// Types
// ============================================================================

interface PublicOperationMeta {
  /** OpenAPI path */
  path: string
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Summary */
  summary: string
  /** Description */
  description: string
  /** Tags */
  tags: string[]
  /** Operation ID */
  operationId: string
  /** Required scopes */
  requiredScopes: string[]
  /** Resource constraints */
  resourceConstraints?: Record<string, boolean>
  /** Whether operation is deprecated */
  deprecated?: boolean
  /** Source file reference */
  fileRef: string
}

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_ROOT = join(import.meta.dirname, '..')
const API_DIR = join(FRONTEND_ROOT, 'server', 'api')
const LAYERS_DIR = join(FRONTEND_ROOT, 'layers')
const OUTPUT_DIR = join(FRONTEND_ROOT, 'server', 'openapi', 'generated')
const OUTPUT_FILE = join(OUTPUT_DIR, 'operations.public.generated.ts')

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a filename is an openapi metadata file
 */
function isOpenApiFile(filename: string): { isOpenApi: boolean; method?: HttpMethod } {
  if (!filename.endsWith('.openapi.ts')) {
    return { isOpenApi: false }
  }

  // Extract method from the corresponding handler filename
  // e.g., "zones.get.openapi.ts" -> method is "get"
  const baseName = filename.replace('.openapi.ts', '')

  for (const method of HTTP_METHODS) {
    if (baseName.endsWith(`.${method}`)) {
      return { isOpenApi: true, method }
    }
  }

  // Could also be "index.get.openapi.ts" pattern
  return { isOpenApi: false }
}

/**
 * Convert file path segment to OpenAPI path segment
 */
function toOpenApiSegment(segment: string): string {
  if (segment.startsWith('[...') && segment.endsWith(']')) {
    return `{${segment.slice(4, -1)}}`
  }
  if (segment.startsWith('[') && segment.endsWith(']')) {
    return `{${segment.slice(1, -1)}}`
  }
  return segment
}

/**
 * Convert file path to OpenAPI path
 */
function filePathToOpenApiPath(filePath: string, apiRoot: string): string {
  const relativePath = relative(apiRoot, filePath)
  const segments = relativePath.split(sep)
  const filename = segments.pop()!

  // Remove .openapi.ts and method suffix
  let nameSegment = filename.replace('.openapi.ts', '')
  for (const method of HTTP_METHODS) {
    const suffix = `.${method}`
    if (nameSegment.endsWith(suffix)) {
      nameSegment = nameSegment.slice(0, -suffix.length)
      break
    }
  }

  if (nameSegment !== 'index') {
    segments.push(nameSegment)
  }

  const openApiSegments = segments.map(toOpenApiSegment)
  return '/api/' + openApiSegments.join('/')
}

/**
 * Generate operation ID from path and method
 */
function generateOperationId(path: string, method: HttpMethod): string {
  const segments = path
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean)

  const parts = segments.map((seg, i) => {
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const param = seg.slice(1, -1)
      return 'By' + param.charAt(0).toUpperCase() + param.slice(1)
    }
    if (i === 0) {
      return seg.toLowerCase()
    }
    return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
  })

  return method + parts.join('')
}

/**
 * Recursively scan a directory for *.openapi.ts files
 */
async function scanDirectory(
  dir: string,
  apiRoot: string
): Promise<{ filePath: string; path: string; method: HttpMethod }[]> {
  const results: { filePath: string; path: string; method: HttpMethod }[] = []

  if (!existsSync(dir)) {
    return results
  }

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      results.push(...(await scanDirectory(fullPath, apiRoot)))
    } else if (stat.isFile()) {
      const { isOpenApi, method } = isOpenApiFile(entry)

      if (isOpenApi && method) {
        const openApiPath = filePathToOpenApiPath(fullPath, apiRoot)
        results.push({
          filePath: fullPath,
          path: openApiPath,
          method,
        })
      }
    }
  }

  return results
}

/**
 * Scan all layers for openapi files
 */
async function scanLayers(): Promise<{ filePath: string; path: string; method: HttpMethod }[]> {
  const results: { filePath: string; path: string; method: HttpMethod }[] = []

  if (!existsSync(LAYERS_DIR)) {
    return results
  }

  const layers = readdirSync(LAYERS_DIR)

  for (const layer of layers) {
    if (layer.startsWith('_') || layer.startsWith('.')) {
      continue
    }

    const layerPath = join(LAYERS_DIR, layer)
    const stat = statSync(layerPath)

    if (!stat.isDirectory()) {
      continue
    }

    const layerApiPath = join(layerPath, 'server', 'api')

    if (existsSync(layerApiPath)) {
      results.push(...(await scanDirectory(layerApiPath, layerApiPath)))
    }
  }

  return results
}

/**
 * Import and validate an openapi metadata file
 */
async function importOperationFile(
  filePath: string,
  path: string,
  method: HttpMethod
): Promise<PublicOperationMeta | null> {
  try {
    // Dynamic import of the openapi file
    const fileUrl = pathToFileURL(filePath).href
    const module = await import(fileUrl)
    const definition = module.default

    if (!definition) {
      console.warn(`   ⚠️ No default export in ${relative(FRONTEND_ROOT, filePath)}`)
      return null
    }

    // Only include public operations
    if (!definition.public) {
      return null
    }

    // Validate required fields
    if (!definition.summary || !definition.description) {
      console.warn(
        `   ⚠️ Public operation missing summary/description: ${relative(FRONTEND_ROOT, filePath)}`
      )
      return null
    }

    if (!definition['x-required-scopes'] || definition['x-required-scopes'].length === 0) {
      console.warn(
        `   ⚠️ Public operation missing x-required-scopes: ${relative(FRONTEND_ROOT, filePath)}`
      )
      return null
    }

    return {
      path,
      method,
      summary: definition.summary,
      description: definition.description,
      tags: definition.tags || [],
      operationId: generateOperationId(path, method),
      requiredScopes: definition['x-required-scopes'],
      resourceConstraints: definition['x-resource-constraints'],
      deprecated: definition.deprecated,
      fileRef: relative(FRONTEND_ROOT, filePath).split(sep).join(posix.sep),
    }
  } catch (error) {
    console.error(`   ❌ Error importing ${relative(FRONTEND_ROOT, filePath)}:`, error)
    return null
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 Scanning for public API operations...')

  // Scan main API directory
  const mainFiles = await scanDirectory(API_DIR, API_DIR)
  console.log(`   Found ${mainFiles.length} *.openapi.ts files in server/api`)

  // Scan layer API directories
  const layerFiles = await scanLayers()
  console.log(`   Found ${layerFiles.length} *.openapi.ts files in layers`)

  const allFiles = [...mainFiles, ...layerFiles]

  // Import and validate each file
  console.log('📦 Processing operation definitions...')
  const publicOperations: PublicOperationMeta[] = []

  for (const file of allFiles) {
    const operation = await importOperationFile(file.filePath, file.path, file.method)
    if (operation) {
      publicOperations.push(operation)
      console.log(`   ✓ ${operation.method.toUpperCase()} ${operation.path}`)
    }
  }

  // Sort operations
  publicOperations.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path)
    if (pathCompare !== 0) return pathCompare
    return a.method.localeCompare(b.method)
  })

  console.log(`   Total public operations: ${publicOperations.length}`)

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    // Already exists from route generation
  }

  // Generate output file
  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Generated by: scripts/generate-public-operations.ts
 * Generated at: ${new Date().toISOString()}
 *
 * This file contains public API operations for OpenAPI spec generation.
 * Re-generate with: npm run generate:openapi
 */

export interface PublicOperationMeta {
  /** OpenAPI path */
  path: string
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Summary */
  summary: string
  /** Description */
  description: string
  /** Tags */
  tags: string[]
  /** Operation ID */
  operationId: string
  /** Required scopes */
  requiredScopes: string[]
  /** Resource constraints */
  resourceConstraints?: Record<string, boolean>
  /** Whether operation is deprecated */
  deprecated?: boolean
  /** Source file reference */
  fileRef: string
}

/**
 * All public API operations (${publicOperations.length} total)
 */
export const publicOperations: PublicOperationMeta[] = ${JSON.stringify(publicOperations, null, 2)}

/**
 * All unique scopes required by public operations
 */
export const allRequiredScopes: string[] = ${JSON.stringify(
    [...new Set(publicOperations.flatMap((op) => op.requiredScopes))].sort(),
    null,
    2
  )}
`

  writeFileSync(OUTPUT_FILE, output, 'utf-8')
  console.log(`✅ Generated: ${relative(process.cwd(), OUTPUT_FILE)}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

