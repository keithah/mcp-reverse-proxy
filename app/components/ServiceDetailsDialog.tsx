'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Terminal, Activity, Settings } from 'lucide-react';

interface ServiceDetailsDialogProps {
  service: any;
  open: boolean;
  onClose: () => void;
}

export function ServiceDetailsDialog({ service, open, onClose }: ServiceDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('logs');
  const [logStream, setLogStream] = useState<string[]>([]);

  const { data: logs } = useQuery({
    queryKey: ['logs', service.id],
    queryFn: async () => {
      const res = await fetch(`/api/services/${service.id}/logs?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
    enabled: open && activeTab === 'logs',
  });

  useEffect(() => {
    if (!open || activeTab !== 'logs') return;

    const ws = new WebSocket(`ws://localhost:8080/api/services/${service.id}/logs/stream`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogStream(prev => [...prev.slice(-99), `[${data.timestamp}] ${data.message}`]);
    };

    return () => {
      ws.close();
    };
  }, [open, activeTab, service.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {service.name} Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('logs')}
                className={`${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Terminal className="h-4 w-4 mr-2" />
                Logs
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`${
                  activeTab === 'metrics'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Activity className="h-4 w-4 mr-2" />
                Metrics
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`${
                  activeTab === 'config'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </button>
            </nav>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'logs' && (
              <div className="space-y-2">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 max-h-96 overflow-auto">
                  {logStream.length > 0 ? (
                    logStream.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap">{log}</div>
                    ))
                  ) : logs?.length > 0 ? (
                    logs.map((log: any, i: number) => (
                      <div key={i} className="whitespace-pre-wrap">
                        [{log.timestamp}] [{log.level}] {log.message}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">No logs available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="space-y-4">
                {service.metrics ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Process ID</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                        {service.metrics.pid}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                        {Math.floor(service.metrics.uptime / 1000)}s
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Restart Count</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                        {service.metrics.restartCount}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                        {service.status}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">Service is not running</div>
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">General</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300 font-mono">{service.id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Proxy Path</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">{service.proxyPath}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Entry Point</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">{service.entryPoint}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Rate Limit</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">{service.rateLimit} req/min</dd>
                    </div>
                  </dl>
                </div>
                
                {service.environment && Object.keys(service.environment).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Environment Variables</h4>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <pre className="text-sm text-gray-900 dark:text-gray-300 overflow-auto">
                        {JSON.stringify(service.environment, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}