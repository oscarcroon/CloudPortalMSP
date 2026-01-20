/**
 * GET /docs/internal
 *
 * Serves Swagger UI for internal API documentation.
 * Protected: Requires session auth + superadmin.
 */
import { defineEventHandler, createError, getCookie } from 'h3'
import { requireSuperAdmin } from '../../utils/rbac'

const SWAGGER_UI_VERSION = '5.17.14'

export default defineEventHandler(async (event) => {
  // Require superadmin access for internal docs
  await requireSuperAdmin(event)

  // Get the session token for pre-authorization in Swagger UI
  const sessionToken = getCookie(event, 'auth_token') || ''

  // Build the HTML page with Swagger UI
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CloudMSP API - Internal Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      background-color: #1e293b;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
    .internal-banner {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
    }
    .internal-banner code {
      background: rgba(255,255,255,0.2);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="internal-banner">
    ⚠️ INTERNAL API DOCUMENTATION - Not for public consumption
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.internal.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        // Pre-authorize with session JWT if available
        onComplete: function() {
          ${
            sessionToken
              ? `
          // Auto-authorize with session token
          window.ui.preauthorizeApiKey('SessionJWT', '${sessionToken}');
          `
              : ''
          }
        }
      });
    };
  </script>
</body>
</html>`

  event.node.res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return html
})

