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

### 🌐 Network & Security
- **UPnP Port Mapping**: Automatic router configuration
- **Port Forwarding Detection**: Real-time port accessibility checking
- **Non-Standard Ports**: Enhanced security (8437, 3437, 8443)
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

### 1️⃣ Start the Container

```bash
# Clone the repository
git clone https://github.com/keithah/mcp-reverse-proxy.git
cd mcp-reverse-proxy

# Start with Docker Compose
docker-compose up -d
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
5. **GitHub (Optional)** - Add token for repository deployments
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
- Repository deployment settings
- Webhook configuration
- Token management

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

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/mcp-reverse-proxy/issues).