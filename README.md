# MCP Reverse Proxy with Management UI

A complete, self-contained reverse proxy system for managing multiple MCP (Model Context Protocol) servers. Features automatic HTTPS with Let's Encrypt, built-in Redis, web-based configuration wizard, and zero-config deployment. No environment variables or external dependencies required!

## ✨ Key Features

### 🚀 Zero Configuration Required
- **Web-Based Setup Wizard**: Configure everything through the browser on first run
- **No Environment Variables**: All settings managed through the UI
- **Built-in Redis**: Redis server included in container - no external setup
- **Automatic HTTPS**: Let's Encrypt certificates fetched and managed automatically
- **Self-Contained**: Single Docker container with everything included

### 🔒 Automatic SSL/HTTPS
- **Let's Encrypt Integration**: Just enter your domain - certificates handled automatically
- **Auto-Renewal**: Certificates renew automatically before expiration
- **Force HTTPS**: Automatic HTTP to HTTPS redirection
- **Cloudflare DNS Support**: Alternative validation without opening port 80
- **Self-Signed Option**: For development environments

### 🌐 Network & External Access
- **Multiple Tunnel Options**: Cloudflare Tunnel, ngrok, Tailscale Funnel
- **UPnP Port Mapping**: Automatic router configuration
- **Port Forwarding Detection**: Real-time port accessibility checking
- **Non-Standard Ports**: Enhanced security (8437, 3437, 8443)
- **Zero-Config External Access**: No manual router configuration needed
- **API Key Authentication**: Secure access control
- **Encrypted Secrets**: Sensitive data encrypted at rest

### 📦 MCP Management
- **Process Management**: Spawn, monitor, restart MCP servers
- **GitHub Deployment**: Deploy MCPs directly from repositories
- **Health Monitoring**: Track process health and metrics
- **Auto-restart**: Configurable restart policies
- **Real-time Logs**: Stream logs from each MCP process
- **Resource Limits**: CPU and memory constraints

### 🎛️ Web Management Interface
- **Initial Setup Wizard**: Step-by-step first-time configuration
- **Settings Panel**: Comprehensive configuration management
- **Real-time Dashboard**: Monitor all services
- **Network Configuration**: Manage SSL, ports, and networking
- **Backup/Restore**: Export and import configurations
- **No Config Files**: Everything managed through the UI

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/keithah/mcp-reverse-proxy.git
cd mcp-reverse-proxy

# Start with Docker Compose
docker-compose up -d
```

### Option 2: Docker Hub (ARM64 & AMD64)

```bash
# Create data directories
mkdir -p data logs mcp-services backups certs

# Run from Docker Hub (works on ARM64 Oracle VMs)
docker run -d \
  --name mcp-proxy \
  -p 8437:8437 \
  -p 3437:3437 \
  -p 8443:8443 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/mcp-services:/app/mcp-services \
  -v $(pwd)/backups:/app/backups \
  -v $(pwd)/certs:/app/certs \
  -e NODE_ENV=production \
  -e INITIAL_SETUP=true \
  --restart unless-stopped \
  keithah/mcp-reverse-proxy:latest
```

### Option 3: Docker Compose for ARM64/Oracle Cloud

```yaml
# docker-compose.yml for ARM64 systems
version: '3.8'

services:
  mcp-proxy:
    image: keithah/mcp-reverse-proxy:latest
    container_name: mcp-proxy
    ports:
      - "8437:8437"  # Backend API
      - "3437:3437"  # Frontend UI
      - "8443:8443"  # HTTPS
    environment:
      - NODE_ENV=production
      - INITIAL_SETUP=true
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./mcp-services:/app/mcp-services
      - ./backups:/app/backups
      - ./certs:/app/certs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8437/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 2️⃣ Open Setup Wizard

Navigate to: **http://localhost:3437**

The setup wizard will guide you through:
1. **Network Configuration** - Set ports and UPnP settings
2. **SSL/HTTPS Setup** - Configure Let's Encrypt or self-signed certificates
3. **Security** - API keys are auto-generated
4. **Database & Redis** - Already configured (built-in)
5. **GitHub Integration** - Optional, for deploying MCPs
6. **Review & Complete** - Save your API key!

### 3️⃣ That's It!

No configuration files, no environment variables, no external dependencies. Everything is configured through the web UI.

## 🎯 First-Time Setup Wizard

When you first access the system, you'll see:

![Setup Wizard Steps]
1. **Welcome Screen** - Overview of what will be configured
2. **Network Settings** - Ports (8437, 3437, 8443) and UPnP auto-configuration
3. **Security & SSL** - Choose Let's Encrypt or self-signed certificates
4. **Built-in Services** - Redis status and connection testing
5. **GitHub (Optional)** - Add token for private repositories only (public repos work without token)
6. **Review & Complete** - Receive your API key for admin access

### Automatic Let's Encrypt Setup

During the SSL step, simply:
1. Select "Let's Encrypt"
2. Enter your domain (e.g., `mcp.yourdomain.com`)
3. Enter your email
4. Click "Complete Setup"

The system will:
- ✅ Contact Let's Encrypt automatically
- ✅ Validate your domain
- ✅ Download and install certificates
- ✅ Configure HTTPS on port 8443
- ✅ Set up auto-renewal
- ✅ Force HTTP to HTTPS redirect

No manual certificate management required!

## 🌐 External Access Options

The MCP Reverse Proxy includes multiple ways to expose your services to the internet without manual router configuration:

### 🚇 Cloudflare Tunnel

Secure, encrypted tunnels without opening ports:

```bash
# Setup with subdomain (free)
curl -X POST http://localhost:8437/api/tunnel/cloudflare/setup \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-cloudflare-token",
    "domain": "mcp-proxy"
  }'
# Creates: https://mcp-proxy.trycloudflare.com

# Setup with custom domain
curl -X POST http://localhost:8437/api/tunnel/cloudflare/setup \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-cloudflare-token",
    "domain": "mcp.yourdomain.com"
  }'
# Creates: https://mcp.yourdomain.com
```

**Benefits:**
- ✅ No port forwarding required
- ✅ DDoS protection included
- ✅ Global CDN
- ✅ **Custom domains supported** (own your URL)
- ✅ Free subdomains (*.trycloudflare.com)
- ✅ Automatic HTTPS certificates

**Requirements:**
- Cloudflare account
- Cloudflare Tunnel token
- For custom domains: Domain must be on Cloudflare DNS

**Custom Domain Setup:**
1. Add your domain to Cloudflare
2. Create a Cloudflare Tunnel in the dashboard
3. Get your tunnel token
4. Use your full domain: `"domain": "mcp.yourdomain.com"`
5. System automatically creates:
   - Main UI: `https://mcp.yourdomain.com`
   - API: `https://api.mcp.yourdomain.com`

### 🚀 ngrok Tunnel

Instant public URLs for development and testing:

```bash
# Setup via API
curl -X POST http://localhost:8437/api/tunnel/ngrok/setup \
  -H "Content-Type: application/json" \
  -d '{
    "authToken": "your-ngrok-token",
    "domain": "your-custom-domain.ngrok.io",
    "region": "us"
  }'
```

**Benefits:**
- ✅ Instant setup
- ✅ Custom domains (paid plans)
- ✅ Multiple regions
- ✅ Great for development

**Requirements:**
- ngrok account (free tier available)
- ngrok auth token

### 🔗 Tailscale Funnel

Private network with public access:

```bash
# Setup via API
curl -X POST http://localhost:8437/api/tunnel/tailscale/setup \
  -H "Content-Type: application/json" \
  -d '{
    "authKey": "your-tailscale-auth-key"
  }'
```

**Benefits:**
- ✅ Zero-trust networking
- ✅ P2P connections
- ✅ ACL controls
- ✅ MagicDNS support

**Requirements:**
- Tailscale account
- Tailscale auth key

### 🔌 UPnP Port Mapping

Automatic router configuration:

```bash
# Setup via API
curl -X POST http://localhost:8437/api/tunnel/upnp/setup \
  -H "Content-Type: application/json"
```

**Benefits:**
- ✅ No external services
- ✅ Direct connections
- ✅ Low latency
- ✅ No monthly costs

**Requirements:**
- UPnP enabled router
- Public IP address

### 🎯 Tunnel Management API

All tunnel options are available via REST API at `/api/tunnel`:

```bash
# Get current tunnel status
curl http://localhost:8437/api/tunnel/config

# Test external connectivity
curl -X POST http://localhost:8437/api/tunnel/test

# Stop all tunnels
curl -X POST http://localhost:8437/api/tunnel/stop
```

### 📱 Web UI Management

Access tunnel configuration through the web interface:
1. Open **Settings** → **Network** → **External Access**
2. Choose your preferred tunnel method
3. Enter required credentials
4. Click **Setup Tunnel**
5. Test connectivity with **Test Connection**

The system will automatically:
- Configure the tunnel service
- Display your external URL
- Monitor tunnel health
- Handle reconnections

## 🎛️ Web-Based Configuration

### No Environment Variables Needed!

All configuration is done through the web UI. The system stores everything in a database and manages all settings internally.

### Settings Panel

Access the comprehensive settings panel by clicking the "Settings" button in the dashboard:

- **Server Configuration**: Ports, environment settings
- **Network Settings**: UPnP, port forwarding
- **Security**: API keys, authentication (auto-generated)
- **SSL/HTTPS**: Let's Encrypt, certificates
- **Redis**: Built-in server status and testing
- **GitHub**: Integration for MCP deployment
- **Monitoring**: Logs, metrics, retention
- **Backup/Restore**: Export and import configurations

### Built-in Redis

Redis is included in the Docker container and managed automatically:
- No external Redis needed
- Runs on localhost:6379 inside container
- Managed by Supervisor
- Persistent data storage
- Zero configuration required

### Configuration Storage

All settings are stored in SQLite database:
- `/app/data/mcp-proxy.db` - Main configuration database
- Encrypted sensitive values
- Persistent across container restarts
- Backup and restore functionality

## 🎯 Container Architecture

### Single Container Solution

The system runs as a single Docker container with multiple services managed by Supervisor:

```
mcp-proxy container:
├── Redis Server (localhost:6379)
├── Backend API (port 8437)
├── Frontend UI (port 3437)
├── HTTPS Server (port 8443)
├── MCP Processes (managed)
└── Supervisor (process manager)
```

### Built-in Services

- **Redis**: Cache and queue management
- **SQLite**: Configuration and data storage
- **Supervisor**: Process management and monitoring
- **SSL Manager**: Automatic certificate handling
- **UPnP Manager**: Network configuration

## 🔧 Advanced Configuration

### Let's Encrypt Options

Two certificate validation methods:

**HTTP-01 Challenge (Default)**
- Requires port 80 accessible from internet
- Automatic domain validation
- Works with most setups

**DNS-01 Challenge (Cloudflare)**
- No port 80 required
- Uses Cloudflare API for DNS records
- Better for behind firewalls/NAT

Configure in Settings → SSL/HTTPS → Provider Options

### Network Ports

The system uses non-standard ports for security:
- **8437**: Backend API (instead of 8080)
- **3437**: Frontend UI (instead of 3000)
- **8443**: HTTPS (instead of 443)

All ports are configurable through the UI.

### Security Features

- **API Key Authentication**: Required for all admin functions
- **Encrypted Storage**: Sensitive data encrypted at rest
- **HSTS Headers**: Strict Transport Security
- **CSP Headers**: Content Security Policy
- **Rate Limiting**: Per-endpoint and global limits
- **Process Isolation**: Each MCP runs separately

## 📱 Using the System

### Access Points

After setup completion:
- **HTTP**: `http://your-domain:8437` (redirects to HTTPS if SSL enabled)
- **HTTPS**: `https://your-domain:8443` (with Let's Encrypt certificate)
- **Local**: `http://localhost:3437` (for initial setup)

## 🎛️ Management Interface

### Dashboard Features

- **Service Overview**: All MCP services with real-time status
- **Health Monitoring**: System health, uptime, resource usage
- **Quick Actions**: Start, stop, restart services
- **Real-time Updates**: Live status updates without refresh

### Settings Panel

Comprehensive configuration management:

**Server Settings**
- Port configuration (8437, 3437, 8443)
- Environment settings
- Performance tuning

**SSL/HTTPS Management**
- Let's Encrypt setup and renewal
- Certificate status and validation
- Force HTTPS configuration

**Network Configuration**
- UPnP port mapping status
- Port forwarding testing
- Public/Private IP detection
- Router configuration status

**Security Settings**
- API key management
- Authentication settings
- Rate limiting configuration

**Redis Management**
- Built-in Redis server status
- Connection testing
- Performance metrics

**GitHub Integration**
- Repository deployment settings (public repos work without token)
- Webhook configuration (requires token)
- Token management (optional for private repos only)

**System Monitoring**
- Log levels and retention
- Metrics collection
- Health check intervals

**Backup/Restore**
- Configuration export
- Settings import
- Restore points

## MCP Service Requirements

For automatic deployment, MCP services should include one of the following:

1. **MCP Manifest File** (`mcp.json` or `mcp-manifest.json`):
```json
{
  "name": "my-mcp-service",
  "description": "My MCP Service",
  "entryPoint": "index.js",
  "requiredEnv": ["API_KEY"],
  "defaultEnv": {
    "PORT": "3000"
  }
}
```

2. **Package.json with MCP Configuration**:
```json
{
  "name": "my-mcp-service",
  "main": "index.js",
  "mcp": {
    "requiredEnv": ["API_KEY"],
    "defaultEnv": {
      "PORT": "3000"
    }
  }
}
```

## Development

### Project Structure
```
├── src/
│   ├── index.ts              # Main server entry point
│   ├── lib/
│   │   ├── process-manager.ts # MCP process management
│   │   ├── github.ts          # GitHub integration
│   │   ├── db/                # Database schema and migrations
│   │   └── logger.ts          # Logging utilities
│   └── server/
│       ├── proxy.ts           # Reverse proxy implementation
│       ├── api.ts             # Management API
│       ├── github-api.ts      # GitHub API endpoints
│       └── middleware/        # Express middleware
├── app/                       # Next.js frontend
│   ├── page.tsx               # Dashboard
│   └── components/            # React components
├── docker-compose.yml         # Docker composition
└── Dockerfile                 # Container definition
```

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

## 🔐 Automatic Let's Encrypt Setup

### Zero-Touch SSL Configuration

The system handles Let's Encrypt automatically:

1. **During Setup Wizard**:
   - Select "Let's Encrypt" as SSL provider
   - Enter your domain (e.g., `proxy.yourdomain.com`)
   - Enter your email for certificate notifications
   - Click "Complete Setup"

2. **What Happens Automatically**:
   ```
   System contacts Let's Encrypt
   ↓
   Validates domain ownership
   ↓
   Downloads SSL certificate
   ↓
   Installs and configures HTTPS
   ↓
   Sets up auto-renewal (daily checks)
   ↓
   Forces HTTP → HTTPS redirect
   ```

3. **Certificate Renewal**:
   - Automatic renewal before expiration
   - Email notifications for any issues
   - Zero downtime certificate updates

### Validation Methods

**HTTP-01 Challenge** (Default)
- Port 80 must be accessible from internet
- Automatic validation via HTTP
- UPnP will map port 80 if enabled

**DNS-01 Challenge** (Cloudflare)
- No port 80 required
- Uses Cloudflare API
- Add Cloudflare token in SSL settings
- Better for complex network setups

### SSL Status Monitoring

Check SSL status in real-time:
- Settings → SSL/HTTPS → Certificate Status
- Expiration dates and renewal status
- Validation method and domain verification

## 📊 Built-in Redis & Supervisor

### Redis Server

Redis runs inside the container automatically:
- **Port**: localhost:6379 (internal only)
- **Persistence**: Data saved to `/app/data`
- **Management**: Controlled by Supervisor
- **Monitoring**: Status available in Settings → Redis

### Supervisor Process Management

All services managed by Supervisor:
```
[Redis Server] - Cache and queues
[Backend API] - Main application
[Frontend UI] - Management interface
```

Process monitoring and auto-restart built-in.

## 🚨 Troubleshooting

### Setup Issues

**Can't access http://localhost:3437**
- Check Docker container is running: `docker-compose ps`
- Verify port mapping in docker-compose.yml
- Check container logs: `docker-compose logs`

**Setup wizard won't complete**
- Ensure Docker has write access to ./data directory
- Check container logs for database errors
- Verify all required dependencies loaded

### SSL Certificate Issues

**Let's Encrypt validation fails**
- Verify domain points to your public IP
- Check port 80 is accessible from internet
- Try Cloudflare DNS validation instead
- Use staging mode first to test

**Certificate not renewing**
- Check Settings → SSL/HTTPS → Certificate Status
- Verify cron job is running
- Check logs for renewal errors

### Network Connection Issues

**Can't connect to HTTPS**
- Verify SSL certificate installed correctly
- Check port 8443 is forwarded through router
- Test with Settings → Network → Port Forwarding Check

**UPnP not working**
- Enable UPnP on your router
- Check Settings → Network → UPnP Status
- Manually forward ports if UPnP unavailable

### Service Management

**MCP service won't start**
- Check Settings → Monitoring → Logs
- Verify service configuration in database
- Test GitHub repository access
- Check resource limits and permissions

**Redis connection failed**
- Check Settings → Redis → Test Connection
- Verify Redis process running in container
- Check Supervisor status

### Getting Help

1. **Container Logs**: `docker-compose logs -f`
2. **Settings Panel**: Check all status indicators
3. **Network Panel**: Test port forwarding and SSL
4. **Backup Config**: Export settings before troubleshooting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/keithah/mcp-reverse-proxy/issues).

## 🌟 What's New

### v2.0 - External Access & Multi-Architecture Support
- ✅ **Cloudflare Tunnel Support**: Zero-config secure tunnels
- ✅ **ngrok Integration**: Instant public URLs
- ✅ **Tailscale Funnel**: Zero-trust networking with public access
- ✅ **Enhanced UPnP**: Automatic router configuration
- ✅ **ARM64 Support**: Works on Oracle Cloud, Raspberry Pi, Apple Silicon
- ✅ **Multi-Architecture Docker**: Single image for AMD64 and ARM64
- ✅ **Docker Hub**: `keithah/mcp-reverse-proxy:latest`
- ✅ **Tunnel Management API**: RESTful tunnel control
- ✅ **Web UI Tunnel Config**: Point-and-click external access setup