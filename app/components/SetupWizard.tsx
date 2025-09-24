'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Shield, Globe, Database, Github, Settings, Check, AlertCircle, Loader2 } from 'lucide-react';

interface SetupWizardProps {
  onComplete: (apiKey: string) => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    server: {
      backendPort: 8437,
      frontendPort: 3437,
      httpsPort: 8443,
      nodeEnv: 'production',
    },
    ssl: {
      enabled: true,
      forceSSL: true,
      provider: 'letsencrypt',
      domain: '',
      email: '',
      staging: false,
    },
    network: {
      enableUPnP: true,
      autoMapPorts: true,
    },
    redis: {
      enabled: true,
      host: 'localhost',
      port: 6379,
    },
    security: {
      apiKeyRequired: true,
    },
    github: {
      enabled: false,
      token: '',
      cloneDirectory: './mcp-services',
    },
    monitoring: {
      logLevel: 'info',
      enableMetrics: true,
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (finalConfig: any) => {
      const res = await fetch('/api/config/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalConfig),
      });
      if (!res.ok) throw new Error('Failed to complete setup');
      return res.json();
    },
    onSuccess: (data) => {
      onComplete(data.apiKey);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async ({ type, config: testConfig }: any) => {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config: testConfig }),
      });
      if (!res.ok) throw new Error('Connection test failed');
      return res.json();
    },
  });

  const steps = [
    { id: 1, name: 'Welcome', icon: Settings },
    { id: 2, name: 'Network', icon: Globe },
    { id: 3, name: 'Security', icon: Shield },
    { id: 4, name: 'Database', icon: Database },
    { id: 5, name: 'GitHub', icon: Github },
    { id: 6, name: 'Review', icon: Check },
  ];

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      completeMutation.mutate(config);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full">
        {/* Progress Bar */}
        <div className="border-b dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, index) => {
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center">
                  <div
                    className={`${
                      step >= s.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    } rounded-full w-10 h-10 flex items-center justify-center`}
                  >
                    {step > s.id ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`${
                        step > s.id ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      } h-1 w-20 mx-2`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {steps.find(s => s.id === step)?.name}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Welcome to MCP Reverse Proxy Setup
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This wizard will help you configure your MCP Reverse Proxy installation.
                All settings can be changed later through the admin interface.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                  What you'll configure:
                </h4>
                <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
                  <li>• Network ports and SSL certificates</li>
                  <li>• Security and authentication settings</li>
                  <li>• Database and Redis configuration</li>
                  <li>• GitHub integration (optional - only needed for private repos)</li>
                </ul>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Network Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Backend Port
                  </label>
                  <input
                    type="number"
                    value={config.server.backendPort}
                    onChange={(e) => setConfig({
                      ...config,
                      server: { ...config.server, backendPort: parseInt(e.target.value) },
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">Non-standard port for API</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Frontend Port
                  </label>
                  <input
                    type="number"
                    value={config.server.frontendPort}
                    onChange={(e) => setConfig({
                      ...config,
                      server: { ...config.server, frontendPort: parseInt(e.target.value) },
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">Non-standard port for UI</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableUPnP"
                    checked={config.network.enableUPnP}
                    onChange={(e) => setConfig({
                      ...config,
                      network: { ...config.network, enableUPnP: e.target.checked },
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enableUPnP" className="ml-2 text-sm text-gray-900 dark:text-gray-300">
                    Enable automatic port forwarding (UPnP)
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Security & SSL Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SSL Provider
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="letsencrypt"
                        checked={config.ssl.provider === 'letsencrypt'}
                        onChange={(e) => setConfig({
                          ...config,
                          ssl: { ...config.ssl, provider: 'letsencrypt' },
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-300">
                        Let's Encrypt (Production)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="self-signed"
                        checked={config.ssl.provider === 'self-signed'}
                        onChange={(e) => setConfig({
                          ...config,
                          ssl: { ...config.ssl, provider: 'self-signed' },
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-300">
                        Self-Signed (Development)
                      </span>
                    </label>
                  </div>
                </div>

                {config.ssl.provider === 'letsencrypt' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Domain
                      </label>
                      <input
                        type="text"
                        placeholder="example.com"
                        value={config.ssl.domain}
                        onChange={(e) => setConfig({
                          ...config,
                          ssl: { ...config.ssl, domain: e.target.value },
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="admin@example.com"
                        value={config.ssl.email}
                        onChange={(e) => setConfig({
                          ...config,
                          ssl: { ...config.ssl, email: e.target.value },
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="forceSSL"
                    checked={config.ssl.forceSSL}
                    onChange={(e) => setConfig({
                      ...config,
                      ssl: { ...config.ssl, forceSSL: e.target.checked },
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="forceSSL" className="ml-2 text-sm text-gray-900 dark:text-gray-300">
                    Force HTTPS (redirect all HTTP traffic)
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Database & Redis Configuration
              </h3>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
                  Built-in Redis
                </h4>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Redis is included and runs inside the container. No external configuration needed.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Redis Status
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    localhost:6379 (Internal)
                  </p>
                </div>
                <button
                  onClick={() => testConnectionMutation.mutate({
                    type: 'redis',
                    config: config.redis,
                  })}
                  disabled={testConnectionMutation.isPending}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {testConnectionMutation.isSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded flex items-center">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {testConnectionMutation.data?.message}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                GitHub Integration (Optional)
              </h3>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
                  Public Repositories Work Without Token
                </h4>
                <p className="text-sm text-green-700 dark:text-green-400">
                  You can deploy public MCP repositories without any GitHub token.
                  Only add a token if you need access to private repositories or webhooks.
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableGitHub"
                  checked={config.github.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    github: { ...config.github, enabled: e.target.checked },
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="enableGitHub" className="ml-2 text-sm text-gray-900 dark:text-gray-300">
                  Enable GitHub integration for deploying MCPs
                </label>
              </div>

              {config.github.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      GitHub Personal Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_..."
                      value={config.github.token}
                      onChange={(e) => setConfig({
                        ...config,
                        github: { ...config.github, token: e.target.value },
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Only required for private repositories and webhooks. Public repos work without a token.
                    </p>
                  </div>

                  {config.github.token && (
                    <button
                      onClick={() => testConnectionMutation.mutate({
                        type: 'github',
                        config: { token: config.github.token },
                      })}
                      disabled={testConnectionMutation.isPending}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {testConnectionMutation.isPending ? 'Testing...' : 'Test GitHub Connection'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Review Configuration
              </h3>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Network</h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">Backend Port:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">{config.server.backendPort}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">Frontend Port:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">{config.server.frontendPort}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">HTTPS Port:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">{config.server.httpsPort}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">UPnP:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">
                      {config.network.enableUPnP ? 'Enabled' : 'Disabled'}
                    </dd>
                  </dl>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Security</h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">SSL Provider:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">{config.ssl.provider}</dd>
                    {config.ssl.domain && (
                      <>
                        <dt className="text-gray-500 dark:text-gray-400">Domain:</dt>
                        <dd className="text-gray-900 dark:text-gray-300">{config.ssl.domain}</dd>
                      </>
                    )}
                    <dt className="text-gray-500 dark:text-gray-400">Force HTTPS:</dt>
                    <dd className="text-gray-900 dark:text-gray-300">
                      {config.ssl.forceSSL ? 'Yes' : 'No'}
                    </dd>
                  </dl>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        Setup Complete
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        After completing setup, you'll receive an API key for accessing the admin interface.
                        Keep it secure!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t dark:border-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={completeMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : step === 6 ? (
              'Complete Setup'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}