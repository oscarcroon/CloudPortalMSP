/**
 * GET /docs/public
 *
 * Serves Swagger UI for public API documentation.
 * Protected: Requires session auth (can be org admin or above).
 */
import { defineEventHandler, getCookie } from 'h3'
import { requireSession } from '../../utils/session'

const SWAGGER_UI_VERSION = '5.17.14'

export default defineEventHandler(async (event) => {
  // Require session for public docs
  await requireSession(event)

  // Get the session token for pre-authorization in Swagger UI
  const sessionToken = getCookie(event, 'auth_token') || ''

  // Build the HTML page with Swagger UI
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CloudMSP API - Public Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      background-color: #0f766e;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
    .public-banner {
      background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .public-banner strong {
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="public-banner">
    <strong>CloudMSP Public API</strong> - Use your Organization API Token for authentication
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.public.json',
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
        // Pre-authorize with session JWT for testing (users should use org tokens)
        onComplete: function() {
          ${
            sessionToken
              ? `
          // Auto-authorize with session token for testing
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

