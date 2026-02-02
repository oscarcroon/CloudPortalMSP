# Traefik Edge Server Configuration

This directory contains the Traefik configuration for the edge server (192.168.2.130).

## Files

- `traefik.yml` - Static configuration (main config)
- `dynamic/` - Dynamic configuration directory (created on server)

## Deployment

### 1. Install Traefik on the edge server

```bash
# On the edge server (192.168.2.130)

# Create directories
sudo mkdir -p /etc/traefik/dynamic
sudo mkdir -p /var/log/traefik

# Create acme.json for certificates (must have strict permissions)
sudo touch /etc/traefik/acme.json
sudo chmod 600 /etc/traefik/acme.json

# Copy static configuration
sudo cp traefik.yml /etc/traefik/traefik.yml
```

### 2. Configure environment variables

Set these environment variables in your Traefik service configuration:

```bash
TRAEFIK_ACME_EMAIL=ssl-admin@yourdomain.com
```

### 3. Run Traefik

Using Docker:

```bash
docker run -d \
  --name traefik \
  --restart=unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /etc/traefik:/etc/traefik:ro \
  -v /etc/traefik/acme.json:/etc/traefik/acme.json \
  -v /var/log/traefik:/var/log/traefik \
  -e TRAEFIK_ACME_EMAIL=ssl-admin@yourdomain.com \
  traefik:v3.0
```

Or as a systemd service:

```ini
# /etc/systemd/system/traefik.service
[Unit]
Description=Traefik Edge Proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/traefik --configFile=/etc/traefik/traefik.yml
Restart=on-failure
RestartSec=5
Environment=TRAEFIK_ACME_EMAIL=ssl-admin@yourdomain.com

[Install]
WantedBy=multi-user.target
```

### 4. Configure SFTP access

The portal application needs SFTP access to upload dynamic configuration:

```bash
# Create a dedicated user for config uploads
sudo useradd -m -s /bin/bash traefik-sync
sudo mkdir -p /home/traefik-sync/.ssh
sudo chmod 700 /home/traefik-sync/.ssh

# Add the portal's SSH public key
sudo nano /home/traefik-sync/.ssh/authorized_keys
sudo chmod 600 /home/traefik-sync/.ssh/authorized_keys
sudo chown -R traefik-sync:traefik-sync /home/traefik-sync/.ssh

# Allow the sync user to write to dynamic config directory
sudo chown traefik-sync:traefik /etc/traefik/dynamic
sudo chmod 775 /etc/traefik/dynamic
```

### 5. Portal Configuration

Set these environment variables in the portal:

```env
# Traefik SFTP Configuration
TRAEFIK_SFTP_HOST=192.168.2.130
TRAEFIK_SFTP_PORT=22
TRAEFIK_SFTP_USERNAME=traefik-sync
TRAEFIK_SFTP_KEY_PATH=/path/to/ssh/private_key
TRAEFIK_SFTP_REMOTE_DIR=/etc/traefik/dynamic

# Traefik Domain Configuration
TRAEFIK_DOMAINS_ENABLED=true
TRAEFIK_PORTAL_BACKEND_URL=http://10.0.0.5:3000
TRAEFIK_DEFAULT_DOMAIN=portal.example.com
TRAEFIK_ACME_EMAIL=ssl-admin@example.com
```

## Dynamic Configuration

The portal uploads dynamic configuration files to `/etc/traefik/dynamic/`:

- `custom-domains.yml` - Routers for verified custom domains
- `redirects-{orgId}.yml` - Redirect configurations per organization

## Security Notes

1. **Let's Encrypt Rate Limits**: 
   - 50 certificates per registered domain per week
   - Only add verified domains to avoid wasting certificate requests

2. **SFTP Security**:
   - Use SSH key authentication only
   - Restrict the sync user to the dynamic config directory

3. **DNS Verification**:
   - All custom domains must be verified via DNS TXT record before being added to Traefik

## Troubleshooting

### Check Traefik logs

```bash
# Real-time logs
docker logs -f traefik
# or
journalctl -u traefik -f

# Access logs
tail -f /var/log/traefik/access.log
```

### Validate configuration

```bash
traefik --configFile=/etc/traefik/traefik.yml --api.dashboard=false --log.level=DEBUG
```

### Check certificate status

```bash
# View acme.json (contains certificates)
sudo cat /etc/traefik/acme.json | jq '.letsencrypt.Certificates | .[] | .domain'
```
