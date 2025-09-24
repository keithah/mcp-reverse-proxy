import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from './logger';
import { JSONRPCRequest, JSONRPCResponse, parseJSONRPCMessage } from 'jsonrpc-lite';

export const MCPConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  repository: z.object({
    url: z.string().url().optional(),
    branch: z.string().default('main'),
    path: z.string().default('./'),
    entryPoint: z.string(),
  }),
  environment: z.record(z.string()).default({}),
  proxy: z.object({
    path: z.string(),
    rateLimit: z.number().default(100),
    cacheTTL: z.number().default(300),
    timeout: z.number().default(30000),
  }),
  process: z.object({
    autoRestart: z.boolean().default(true),
    maxRestarts: z.number().default(5),
    maxMemory: z.string().default('512MB'),
    healthCheckInterval: z.number().default(30),
  }),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;

interface MCPProcessState {
  status: 'starting' | 'running' | 'stopped' | 'crashed' | 'restarting';
  pid?: number;
  startTime?: Date;
  restartCount: number;
  lastError?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

export class MCPProcess extends EventEmitter {
  private process?: ChildProcess;
  private state: MCPProcessState;
  private healthCheckInterval?: NodeJS.Timeout;
  private requestCallbacks: Map<string | number, (response: JSONRPCResponse) => void> = new Map();
  private buffer: string = '';
  private restartTimeout?: NodeJS.Timeout;

  constructor(public config: MCPConfig) {
    super();
    this.state = {
      status: 'stopped',
      restartCount: 0,
    };
  }

  async start(): Promise<void> {
    if (this.state.status === 'running') {
      logger.warn(`MCP ${this.config.id} is already running`);
      return;
    }

    this.state.status = 'starting';
    this.emit('status', this.state.status);

    try {
      const workingDir = `${this.config.repository.path}/${this.config.id}`;
      
      this.process = spawn('node', [this.config.repository.entryPoint], {
        cwd: workingDir,
        env: {
          ...process.env,
          ...this.config.environment,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => this.handleStdout(data));
      this.process.stderr?.on('data', (data) => this.handleStderr(data));
      
      this.process.on('exit', (code, signal) => {
        this.handleProcessExit(code, signal);
      });

      this.process.on('error', (error) => {
        logger.error(`MCP ${this.config.id} process error:`, error);
        this.state.lastError = error.message;
        this.handleProcessExit(1, null);
      });

      this.state = {
        ...this.state,
        status: 'running',
        pid: this.process.pid,
        startTime: new Date(),
      };

      this.emit('status', this.state.status);
      this.startHealthCheck();
      
      logger.info(`MCP ${this.config.id} started with PID ${this.process.pid}`);
    } catch (error) {
      logger.error(`Failed to start MCP ${this.config.id}:`, error);
      this.state.status = 'crashed';
      this.state.lastError = error instanceof Error ? error.message : String(error);
      this.emit('status', this.state.status);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.state.status === 'stopped') {
      return;
    }

    this.stopHealthCheck();
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = undefined;
    }

    if (this.process) {
      this.state.status = 'stopped';
      this.emit('status', this.state.status);
      
      this.process.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = undefined;
      logger.info(`MCP ${this.config.id} stopped`);
    }
  }

  async restart(): Promise<void> {
    logger.info(`Restarting MCP ${this.config.id}`);
    await this.stop();
    await this.start();
  }

  async sendRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (this.state.status !== 'running' || !this.process?.stdin) {
      throw new Error(`MCP ${this.config.id} is not running`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(request.id);
        reject(new Error(`Request timeout for MCP ${this.config.id}`));
      }, this.config.proxy.timeout);

      this.requestCallbacks.set(request.id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message);
    });
  }

  private handleStdout(data: Buffer): void {
    this.buffer += data.toString();
    
    let lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = parseJSONRPCMessage(line);
        
        if ('id' in message && this.requestCallbacks.has(message.id)) {
          const callback = this.requestCallbacks.get(message.id)!;
          this.requestCallbacks.delete(message.id);
          callback(message as JSONRPCResponse);
        } else {
          this.emit('notification', message);
        }
      } catch (error) {
        logger.debug(`Non-JSON output from MCP ${this.config.id}: ${line}`);
        this.emit('log', line);
      }
    }
  }

  private handleStderr(data: Buffer): void {
    const message = data.toString();
    logger.error(`MCP ${this.config.id} stderr: ${message}`);
    this.emit('error', message);
  }

  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    logger.info(`MCP ${this.config.id} exited with code ${code}, signal ${signal}`);
    
    this.stopHealthCheck();
    this.process = undefined;
    
    const previousStatus = this.state.status;
    
    if (previousStatus === 'stopped') {
      return;
    }
    
    this.state.status = 'crashed';
    this.emit('status', this.state.status);
    
    if (this.config.process.autoRestart && this.state.restartCount < this.config.process.maxRestarts) {
      this.state.restartCount++;
      this.state.status = 'restarting';
      this.emit('status', this.state.status);
      
      const delay = Math.min(1000 * Math.pow(2, this.state.restartCount), 30000);
      logger.info(`Restarting MCP ${this.config.id} in ${delay}ms (attempt ${this.state.restartCount})`);
      
      this.restartTimeout = setTimeout(() => {
        this.start().catch(error => {
          logger.error(`Failed to restart MCP ${this.config.id}:`, error);
        });
      }, delay);
    } else if (this.state.restartCount >= this.config.process.maxRestarts) {
      logger.error(`MCP ${this.config.id} exceeded max restart attempts`);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.process && this.process.pid) {
        try {
          process.kill(this.process.pid, 0);
        } catch {
          logger.warn(`MCP ${this.config.id} process not responding`);
          this.handleProcessExit(null, null);
        }
      }
    }, this.config.process.healthCheckInterval * 1000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  getState(): MCPProcessState {
    return { ...this.state };
  }

  getMetrics() {
    if (!this.process?.pid) {
      return null;
    }
    
    return {
      pid: this.process.pid,
      status: this.state.status,
      uptime: this.state.startTime ? Date.now() - this.state.startTime.getTime() : 0,
      restartCount: this.state.restartCount,
      memoryUsage: this.state.memoryUsage || 0,
      cpuUsage: this.state.cpuUsage || 0,
    };
  }
}

export class ProcessManager {
  private processes: Map<string, MCPProcess> = new Map();
  
  async addProcess(config: MCPConfig): Promise<MCPProcess> {
    if (this.processes.has(config.id)) {
      throw new Error(`Process ${config.id} already exists`);
    }
    
    const mcpProcess = new MCPProcess(config);
    this.processes.set(config.id, mcpProcess);
    
    return mcpProcess;
  }
  
  getProcess(id: string): MCPProcess | undefined {
    return this.processes.get(id);
  }
  
  getAllProcesses(): MCPProcess[] {
    return Array.from(this.processes.values());
  }
  
  async removeProcess(id: string): Promise<void> {
    const process = this.processes.get(id);
    if (process) {
      await process.stop();
      this.processes.delete(id);
    }
  }
  
  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.processes.values()).map(p => p.stop())
    );
  }
}