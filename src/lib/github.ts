import simpleGit, { SimpleGit } from 'simple-git';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export const DeployRequestSchema = z.object({
  repositoryUrl: z.string().url(),
  branch: z.string().default('main'),
  serviceName: z.string(),
  environment: z.record(z.string()).optional(),
});

export type DeployRequest = z.infer<typeof DeployRequestSchema>;

export interface MCPManifest {
  name: string;
  description?: string;
  entryPoint: string;
  version?: string;
  author?: string;
  license?: string;
  requiredEnv?: string[];
  defaultEnv?: Record<string, string>;
}

export class GitHubService {
  private git: SimpleGit;
  private cloneDirectory: string;

  constructor(cloneDirectory?: string) {
    this.cloneDirectory = cloneDirectory || process.env.CLONE_DIRECTORY || './mcp-services';
    this.git = simpleGit();
  }

  async deployFromGitHub(request: DeployRequest): Promise<{
    path: string;
    manifest: MCPManifest;
  }> {
    const repoName = this.extractRepoName(request.repositoryUrl);
    const targetPath = path.join(this.cloneDirectory, request.serviceName || repoName);

    try {
      await fs.mkdir(this.cloneDirectory, { recursive: true });

      const exists = await this.directoryExists(targetPath);
      
      if (exists) {
        logger.info(`Repository already exists at ${targetPath}, pulling latest changes`);
        const repoGit = simpleGit(targetPath);
        await repoGit.checkout(request.branch);
        await repoGit.pull('origin', request.branch);
      } else {
        logger.info(`Cloning repository ${request.repositoryUrl} to ${targetPath}`);
        await this.git.clone(request.repositoryUrl, targetPath, [
          '--branch', request.branch,
          '--single-branch',
        ]);
      }

      const manifest = await this.discoverMCPManifest(targetPath);
      
      await this.installDependencies(targetPath);
      
      if (await this.fileExists(path.join(targetPath, 'tsconfig.json'))) {
        await this.buildTypeScript(targetPath);
      }

      return {
        path: targetPath,
        manifest,
      };
    } catch (error) {
      logger.error('Failed to deploy from GitHub:', error);
      throw new Error(`Failed to deploy from GitHub: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateFromGitHub(servicePath: string, branch: string = 'main'): Promise<void> {
    try {
      const repoGit = simpleGit(servicePath);
      
      const status = await repoGit.status();
      if (status.modified.length > 0 || status.not_added.length > 0) {
        logger.warn(`Repository at ${servicePath} has uncommitted changes, stashing`);
        await repoGit.stash();
      }
      
      await repoGit.checkout(branch);
      await repoGit.pull('origin', branch);
      
      await this.installDependencies(servicePath);
      
      if (await this.fileExists(path.join(servicePath, 'tsconfig.json'))) {
        await this.buildTypeScript(servicePath);
      }
      
      logger.info(`Successfully updated repository at ${servicePath}`);
    } catch (error) {
      logger.error(`Failed to update repository at ${servicePath}:`, error);
      throw new Error(`Failed to update repository: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async discoverMCPManifest(repoPath: string): Promise<MCPManifest> {
    const possibleManifestPaths = [
      'mcp.json',
      'mcp-manifest.json',
      '.mcp.json',
      'package.json',
    ];

    for (const manifestPath of possibleManifestPaths) {
      const fullPath = path.join(repoPath, manifestPath);
      if (await this.fileExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const data = JSON.parse(content);
        
        if (manifestPath === 'package.json') {
          return this.extractManifestFromPackageJson(data);
        }
        
        if (this.isValidMCPManifest(data)) {
          return data;
        }
      }
    }

    return this.generateDefaultManifest(repoPath);
  }

  private extractManifestFromPackageJson(packageJson: any): MCPManifest {
    const main = packageJson.main || 'index.js';
    const scripts = packageJson.scripts || {};
    
    let entryPoint = main;
    if (scripts.start && scripts.start.includes('node')) {
      const match = scripts.start.match(/node\s+([\w\/\.]+)/);
      if (match) {
        entryPoint = match[1];
      }
    }

    return {
      name: packageJson.name || 'unknown-mcp',
      description: packageJson.description,
      entryPoint,
      version: packageJson.version,
      author: typeof packageJson.author === 'string' ? packageJson.author : packageJson.author?.name,
      license: packageJson.license,
      requiredEnv: packageJson.mcp?.requiredEnv,
      defaultEnv: packageJson.mcp?.defaultEnv,
    };
  }

  private async generateDefaultManifest(repoPath: string): Promise<MCPManifest> {
    const possibleEntryPoints = [
      'index.js',
      'main.js',
      'server.js',
      'app.js',
      'src/index.js',
      'src/main.js',
      'src/server.js',
      'dist/index.js',
      'build/index.js',
    ];

    for (const entryPoint of possibleEntryPoints) {
      if (await this.fileExists(path.join(repoPath, entryPoint))) {
        return {
          name: path.basename(repoPath),
          entryPoint,
        };
      }
    }

    throw new Error('Could not find MCP entry point');
  }

  private isValidMCPManifest(data: any): data is MCPManifest {
    return (
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      typeof data.entryPoint === 'string'
    );
  }

  private async installDependencies(repoPath: string): Promise<void> {
    const packageJsonPath = path.join(repoPath, 'package.json');
    
    if (await this.fileExists(packageJsonPath)) {
      logger.info(`Installing dependencies for ${repoPath}`);
      
      const packageManager = await this.detectPackageManager(repoPath);
      const installCommand = packageManager === 'yarn' ? 'yarn install' : 'npm install';
      
      const { stdout, stderr } = await execAsync(installCommand, {
        cwd: repoPath,
      });
      
      if (stderr && !stderr.includes('warning')) {
        logger.warn(`Dependency installation warnings: ${stderr}`);
      }
      
      logger.info(`Dependencies installed successfully`);
    }
  }

  private async buildTypeScript(repoPath: string): Promise<void> {
    logger.info(`Building TypeScript project at ${repoPath}`);
    
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: repoPath,
    });
    
    if (stderr && !stderr.includes('warning')) {
      logger.warn(`TypeScript build warnings: ${stderr}`);
    }
    
    logger.info(`TypeScript build completed successfully`);
  }

  private async detectPackageManager(repoPath: string): Promise<'npm' | 'yarn'> {
    if (await this.fileExists(path.join(repoPath, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  private extractRepoName(url: string): string {
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    return match ? match[1] : 'unknown-repo';
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  async listDeployedServices(): Promise<Array<{
    name: string;
    path: string;
    manifest?: MCPManifest;
  }>> {
    try {
      await fs.mkdir(this.cloneDirectory, { recursive: true });
      
      const entries = await fs.readdir(this.cloneDirectory, { withFileTypes: true });
      const services = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const servicePath = path.join(this.cloneDirectory, entry.name);
          try {
            const manifest = await this.discoverMCPManifest(servicePath);
            services.push({
              name: entry.name,
              path: servicePath,
              manifest,
            });
          } catch (error) {
            logger.warn(`Could not load manifest for ${entry.name}:`, error);
            services.push({
              name: entry.name,
              path: servicePath,
            });
          }
        }
      }
      
      return services;
    } catch (error) {
      logger.error('Failed to list deployed services:', error);
      return [];
    }
  }
}