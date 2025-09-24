# MCP Reverse Proxy with Management UI

A comprehensive reverse proxy system for managing multiple MCP (Model Context Protocol) servers as child processes, featuring automatic HTTPS with Let's Encrypt, UPnP port mapping, and a web-based management interface for deploying services from GitHub repositories.

## Features

- **Automatic HTTPS**: Let's Encrypt integration with auto-renewal
- **Force SSL**: Automatic HTTP to HTTPS redirection
- **UPnP Port Mapping**: Automatic router configuration for port forwarding
- **Port Forwarding Detection**: Check if your ports are accessible from the internet
- **Non-Standard Ports**: Enhanced security using non-common ports (8437, 3437, 8443)
- **Process Management**: Spawn, monitor, restart, and terminate MCP server processes
- **Reverse Proxy**: Single HTTP/WebSocket endpoint for all MCP communications
- **GitHub Integration**: Deploy MCPs directly from GitHub repositories
- **Web Management UI**: Real-time dashboard with network configuration
- **Rate Limiting & Caching**: Built-in rate limiting and response caching
- **Health Monitoring**: Track process health, memory usage, and responsiveness
- **Auto-restart**: Configurable restart policies on crashes
- **Secure API**: API key authentication and encrypted secret storage

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mcp-reverse-proxy.git
cd mcp-reverse-proxy
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the management UI at http://localhost:3000

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
npm run db:generate
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

## Configuration

### Environment Variables

```bash
# Server Configuration - Non-Standard Ports for Security
BACKEND_PORT=8437      # Main backend API port
FRONTEND_PORT=3437     # Frontend UI port
HTTPS_PORT=8443        # HTTPS port
NODE_ENV=production

# SSL/HTTPS Configuration
SSL_ENABLED=true
FORCE_SSL=true         # Force redirect HTTP to HTTPS
DOMAIN=your-domain.com
SSL_EMAIL=admin@your-domain.com
SSL_STAGING=false      # Set to true for testing
SSL_PROVIDER=letsencrypt  # or 'self-signed'
# Optional: For Cloudflare DNS challenge (recommended)
CLOUDFLARE_TOKEN=your-cloudflare-api-token

# Network Configuration
ENABLE_UPNP=true       # Auto-configure router port forwarding
AUTO_MAP_PORTS=true    # Automatically map ports via UPnP
# Optional: Manual IP configuration
# PUBLIC_IP=x.x.x.x
# PRIVATE_IP=192.168.x.x

# Database
DATABASE_URL=./data/mcp-proxy.db

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
API_KEY=your-api-key-here

# GitHub Integration
GITHUB_TOKEN=your-github-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret
CLONE_DIRECTORY=./mcp-services

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

## API Documentation

### MCP Proxy Endpoints

#### Send Request to MCP Service
```http
POST /mcp/{service-id}/*
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "methodName",
  "params": {},
  "id": 1
}
```

#### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:8080/mcp/ws?service=service-id');
```

### Management API

#### List Services
```http
GET /api/services
X-API-Key: your-api-key
```

#### Create Service
```http
POST /api/services
X-API-Key: your-api-key
Content-Type: application/json

{
  "name": "my-mcp-service",
  "repository": {
    "url": "https://github.com/user/repo",
    "branch": "main",
    "entryPoint": "index.js"
  },
  "environment": {
    "API_KEY": "value"
  },
  "proxy": {
    "path": "/mcp/my-service",
    "rateLimit": 100
  },
  "process": {
    "autoRestart": true,
    "maxRestarts": 5
  }
}
```

#### Start/Stop/Restart Service
```http
POST /api/services/{id}/start
POST /api/services/{id}/stop
POST /api/services/{id}/restart
X-API-Key: your-api-key
```

### GitHub Integration API

#### Deploy from GitHub
```http
POST /api/github/deploy
X-API-Key: your-api-key
Content-Type: application/json

{
  "repositoryUrl": "https://github.com/user/repo",
  "branch": "main",
  "serviceName": "my-service",
  "environment": {
    "API_KEY": "value"
  }
}
```

## Management UI

The web-based management interface provides:

- **Dashboard**: Overview of all services with status indicators
- **Service Management**: Start, stop, restart, and delete services
- **Real-time Logs**: Stream logs from each MCP process
- **Metrics**: CPU, memory, and request metrics
- **GitHub Deployment**: Deploy new services from GitHub repositories
- **Configuration Editor**: Edit environment variables and settings
- **Network Configuration**:
  - SSL/HTTPS setup with Let's Encrypt
  - Port forwarding status and testing
  - UPnP configuration
  - Public/Private IP detection
- **Security Features**:
  - Force SSL with HSTS headers
  - Content Security Policy
  - Non-standard ports to avoid scanning

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

## Security Considerations

- **HTTPS by Default**: Automatic Let's Encrypt certificates with forced SSL
- **Non-Standard Ports**: Uses 8437, 3437, 8443 instead of common ports
- **HSTS Headers**: Strict Transport Security enabled
- **CSP Headers**: Content Security Policy for XSS protection
- **API Authentication**: All endpoints require API keys
- **Encrypted Storage**: Environment variables encrypted at rest
- **Webhook Verification**: GitHub webhook signatures verified
- **Process Isolation**: MCPs run in separate processes
- **Resource Limits**: Prevent runaway processes
- **UPnP Security**: Optional - can be disabled for manual port forwarding

## SSL/HTTPS Setup

### Let's Encrypt (Recommended for Production)

1. **Prerequisites**:
   - A domain name pointing to your server's public IP
   - Port 80 and 443 (or your configured ports) accessible from internet
   - Valid email address for certificate notifications

2. **Configuration**:
   ```bash
   SSL_ENABLED=true
   DOMAIN=your-domain.com
   SSL_EMAIL=admin@your-domain.com
   SSL_PROVIDER=letsencrypt
   SSL_STAGING=false  # Use true for testing
   ```

3. **Cloudflare DNS Challenge** (Alternative - doesn't require port 80):
   ```bash
   CLOUDFLARE_TOKEN=your-api-token
   ```

### Self-Signed Certificates (Development)

1. The system will automatically generate a self-signed certificate
2. Configure with:
   ```bash
   SSL_ENABLED=true
   SSL_PROVIDER=self-signed
   ```

### Port Configuration

The system uses non-standard ports for enhanced security:

- **Backend API**: 8437 (instead of 8080)
- **Frontend UI**: 3437 (instead of 3000)
- **HTTPS**: 8443 (instead of 443)

### UPnP Port Mapping

If your router supports UPnP:

1. The system will automatically configure port forwarding
2. Check status in the Network Configuration panel
3. Disable with `ENABLE_UPNP=false` if you prefer manual configuration

### Manual Port Forwarding

If UPnP is disabled or unavailable:

1. Forward these ports in your router:
   - External 8437 → Internal 8437 (Backend)
   - External 3437 → Internal 3437 (Frontend)
   - External 8443 → Internal 8443 (HTTPS)

2. Test connectivity:
   ```bash
   curl https://your-domain.com:8443/health
   ```

## Troubleshooting

### Service Won't Start
- Check logs in `logs/` directory
- Verify entry point exists
- Ensure dependencies are installed
- Check environment variables

### Connection Refused
- Verify service is running: `GET /api/services/{id}`
- Check proxy path configuration
- Review rate limits

### GitHub Deployment Fails
- Verify GitHub token has repository access
- Check clone directory permissions
- Ensure package.json exists in repository
- Review deployment logs

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