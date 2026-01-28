/**
 * OpenAPI Route Scanner
 *
 * Scans Nitro API routes and generates a static route inventory for OpenAPI spec generation.
 * This script is run at build/CI time, NOT at runtime.
 *
 * Usage: npx tsx scripts/generate-openapi-routes.ts
 */

import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative, basename, dirname, sep, posix } from 'node:path'

// ============================================================================
// Types
// ============================================================================

interface RouteDefinition {
  /** OpenAPI path, e.g. "/api/organizations/{orgId}/members" */
  path: string
  /** HTTP method in lowercase */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Tags for grouping in OpenAPI, derived from directory structure */
  tags: string[]
  /** Original file path relative to frontend, for reference */
  fileRef: string
  /** Layer name if from a layer, otherwise null */
  layer: string | null
  /** Operation ID (unique identifier for the operation) */
  operationId: string
}

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_ROOT = join(import.meta.dirname, '..')
const API_DIR = join(FRONTEND_ROOT, 'server', 'api')
const LAYERS_DIR = join(FRONTEND_ROOT, 'layers')
const OUTPUT_DIR = join(FRONTEND_ROOT, 'server', 'openapi', 'generated')
const OUTPUT_FILE = join(OUTPUT_DIR, 'routes.internal.generated.ts')

// Valid HTTP method suffixes
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

// Files to ignore
const IGNORE_PATTERNS = [
  /\.schema\.ts$/,
  /\.openapi\.ts$/,
  /helpers\.ts$/,
  /utils\.ts$/,
  /types\.ts$/,
  /index\.ts$/, // index.ts without method suffix
]

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a filename represents an API route handler
 */
function isRouteHandler(filename: string): { isRoute: boolean; method?: HttpMethod } {
  // Must be a .ts file
  if (!filename.endsWith('.ts')) {
    return { isRoute: false }
  }

  // Check ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(filename)) {
      return { isRoute: false }
    }
  }

  // Extract method from suffix
  for (const method of HTTP_METHODS) {
    if (filename.endsWith(`.${method}.ts`)) {
      return { isRoute: true, method }
    }
  }

  return { isRoute: false }
}

/**
 * Convert file path segment to OpenAPI path segment
 * [param] -> {param}
 * [...slug] -> {slug} (catch-all, simplified)
 */
function toOpenApiSegment(segment: string): string {
  // Dynamic catch-all: [...slug] -> {slug}
  if (segment.startsWith('[...') && segment.endsWith(']')) {
    return `{${segment.slice(4, -1)}}`
  }
  // Dynamic segment: [param] -> {param}
  if (segment.startsWith('[') && segment.endsWith(']')) {
    return `{${segment.slice(1, -1)}}`
  }
  return segment
}

/**
 * Convert file path to OpenAPI path
 */
function filePathToOpenApiPath(filePath: string, apiRoot: string): string {
  // Get relative path from API root
  const relativePath = relative(apiRoot, filePath)

  // Split into segments and remove the filename
  const segments = relativePath.split(sep)
  const filename = segments.pop()!

  // Remove method suffix from filename to get the "name" part
  // e.g., "members.get.ts" -> "members", "[id].get.ts" -> "[id]"
  let nameSegment = filename
  for (const method of HTTP_METHODS) {
    const suffix = `.${method}.ts`
    if (nameSegment.endsWith(suffix)) {
      nameSegment = nameSegment.slice(0, -suffix.length)
      break
    }
  }

  // If nameSegment is "index", don't add it to path
  if (nameSegment !== 'index') {
    segments.push(nameSegment)
  }

  // Convert all segments to OpenAPI format
  const openApiSegments = segments.map(toOpenApiSegment)

  // Build final path with /api prefix
  return '/api/' + openApiSegments.join('/')
}

/**
 * Generate tags from path segments
 */
function generateTags(segments: string[], layer: string | null): string[] {
  const tags: string[] = []

  // Add layer as first tag if present
  if (layer) {
    tags.push(layer)
  }

  // Add first significant path segment as a tag
  // Skip common prefixes like "api"
  for (const segment of segments) {
    if (segment && !segment.startsWith('{') && segment !== 'api') {
      tags.push(segment)
      break
    }
  }

  return tags.length > 0 ? tags : ['default']
}

/**
 * Generate a unique operationId from path and method
 */
function generateOperationId(path: string, method: HttpMethod): string {
  // Remove /api prefix and convert to camelCase
  const segments = path
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean)

  const parts = segments.map((seg, i) => {
    // Convert {param} to ByParam
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const param = seg.slice(1, -1)
      return 'By' + param.charAt(0).toUpperCase() + param.slice(1)
    }
    // First segment: lowercase, rest: capitalize first letter
    if (i === 0) {
      return seg.toLowerCase()
    }
    return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
  })

  // Add method prefix
  return method + parts.join('')
}

/**
 * Recursively scan a directory for route handlers
 */
function scanDirectory(
  dir: string,
  apiRoot: string,
  layer: string | null
): RouteDefinition[] {
  const routes: RouteDefinition[] = []

  if (!existsSync(dir)) {
    return routes
  }

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      routes.push(...scanDirectory(fullPath, apiRoot, layer))
    } else if (stat.isFile()) {
      const { isRoute, method } = isRouteHandler(entry)

      if (isRoute && method) {
        const openApiPath = filePathToOpenApiPath(fullPath, apiRoot)
        const fileRef = relative(FRONTEND_ROOT, fullPath).split(sep).join(posix.sep)
        const pathSegments = openApiPath.split('/').filter(Boolean)
        const tags = generateTags(pathSegments, layer)
        const operationId = generateOperationId(openApiPath, method)

        routes.push({
          path: openApiPath,
          method,
          tags,
          fileRef,
          layer,
          operationId,
        })
      }
    }
  }

  return routes
}

/**
 * Scan all layers for API routes
 */
function scanLayers(): RouteDefinition[] {
  const routes: RouteDefinition[] = []

  if (!existsSync(LAYERS_DIR)) {
    return routes
  }

  const layers = readdirSync(LAYERS_DIR)

  for (const layer of layers) {
    // Skip non-directories and special directories
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
      routes.push(...scanDirectory(layerApiPath, layerApiPath, layer))
    }
  }

  return routes
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('🔍 Scanning Nitro API routes...')

  // Scan main API directory
  const mainRoutes = scanDirectory(API_DIR, API_DIR, null)
  console.log(`   Found ${mainRoutes.length} routes in server/api`)

  // Scan layer API directories
  const layerRoutes = scanLayers()
  console.log(`   Found ${layerRoutes.length} routes in layers`)

  // Combine and sort routes
  const allRoutes = [...mainRoutes, ...layerRoutes].sort((a, b) => {
    // Sort by path first, then by method
    const pathCompare = a.path.localeCompare(b.path)
    if (pathCompare !== 0) return pathCompare
    return a.method.localeCompare(b.method)
  })

  console.log(`   Total: ${allRoutes.length} routes`)

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Generate output file
  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * Generated by: scripts/generate-openapi-routes.ts
 * Generated at: ${new Date().toISOString()}
 *
 * This file contains all Nitro API routes for OpenAPI spec generation.
 * Re-generate with: npm run generate:openapi
 */

export interface InternalRouteDefinition {
  /** OpenAPI path, e.g. "/api/organizations/{orgId}/members" */
  path: string
  /** HTTP method in lowercase */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Tags for grouping in OpenAPI */
  tags: string[]
  /** Original file path relative to frontend */
  fileRef: string
  /** Layer name if from a layer, otherwise null */
  layer: string | null
  /** Operation ID (unique identifier) */
  operationId: string
}

/**
 * All internal API routes (${allRoutes.length} total)
 */
export const internalRoutes: InternalRouteDefinition[] = ${JSON.stringify(allRoutes, null, 2)} as const

/**
 * Routes grouped by tag
 */
export const routesByTag: Record<string, InternalRouteDefinition[]> = ${JSON.stringify(
    allRoutes.reduce(
      (acc, route) => {
        for (const tag of route.tags) {
          if (!acc[tag]) acc[tag] = []
          acc[tag].push(route)
        }
        return acc
      },
      {} as Record<string, RouteDefinition[]>
    ),
    null,
    2
  )}

/**
 * All unique tags
 */
export const allTags: string[] = ${JSON.stringify(
    [...new Set(allRoutes.flatMap((r) => r.tags))].sort(),
    null,
    2
  )}
`

  writeFileSync(OUTPUT_FILE, output, 'utf-8')
  console.log(`✅ Generated: ${relative(process.cwd(), OUTPUT_FILE)}`)
}

main()

