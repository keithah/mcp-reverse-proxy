# MCP Reverse Proxy with Management UI

A comprehensive reverse proxy system for managing multiple MCP (Model Context Protocol) servers as child processes, featuring a web-based management interface for deploying, configuring, and monitoring MCP services from GitHub repositories.

## Features

- **Process Management**: Spawn, monitor, restart, and terminate MCP server processes
- **Reverse Proxy**: Single HTTP/WebSocket endpoint for all MCP communications
- **GitHub Integration**: Deploy MCPs directly from GitHub repositories
- **Web Management UI**: Real-time dashboard for service management
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
# Server Configuration
PORT=8080
NODE_ENV=production

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

- All API endpoints require authentication via API keys
- Environment variables are encrypted at rest
- GitHub webhook signatures are verified
- Process isolation ensures MCPs run in separate processes
- Resource limits prevent runaway processes

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