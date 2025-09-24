'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, Server, Shield, Database, Github, Bell, Download, Upload, 
  Save, RefreshCw, TestTube, Check, X, Loader2, Key, Globe, Wifi 
} from 'lucide-react';

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('server');
  const [config, setConfig] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/config', {
        headers: { 'X-API-Key': localStorage.getItem('apiKey') || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch configuration');
      return res.json();
    },
  });

  useEffect(() => {
    if (configData) {
      setConfig(configData);
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('apiKey') || '',
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save configuration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setHasChanges(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ type, config: testConfig }: any) => {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('apiKey') || '',
        },
        body: JSON.stringify({ type, config: testConfig }),
      });
      if (!res.ok) throw new Error('Test failed');
      return res.json();
    },
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/config/backup', {
        method: 'POST',
        headers: { 'X-API-Key': localStorage.getItem('apiKey') || '' },
      });
      if (!res.ok) throw new Error('Backup failed');
      return res.json();
    },
  });

  const handleConfigChange = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const tabs = [
    { id: 'server', name: 'Server', icon: Server },
    { id: 'network', name: 'Network', icon: Globe },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'ssl', name: 'SSL/HTTPS', icon: Key },
    { id: 'redis', name: 'Redis', icon: Database },
    { id: 'github', name: 'GitHub', icon: Github },
    { id: 'monitoring', name: 'Monitoring', icon: Bell },
    { id: 'backup', name: 'Backup', icon: Download },
  ];

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex border-b dark:border-gray-700">
        <div className="w-48 border-r dark:border-gray-700">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                  } w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors`}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 p-6">
          {activeTab === 'server' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Server Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Backend Port
                  </label>
                  <input
                    type="number"
                    value={config.server.backendPort}
                    onChange={(e) => handleConfigChange('server', 'backendPort', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Frontend Port
                  </label>
                  <input
                    type="number"
                    value={config.server.frontendPort}
                    onChange={(e) => handleConfigChange('server', 'frontendPort', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    HTTPS Port
                  </label>
                  <input
                    type="number"
                    value={config.server.httpsPort}
                    onChange={(e) => handleConfigChange('server', 'httpsPort', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Environment
                  </label>
                  <select
                    value={config.server.nodeEnv}
                    onChange={(e) => handleConfigChange('server', 'nodeEnv', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                    <option value="test">Test</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'redis' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Redis Configuration</h3>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex">
                  <Database className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-300">
                      Built-in Redis Server
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      Redis runs inside the container at localhost:6379. No external configuration required.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Redis Connection</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">localhost:6379</p>
                </div>
                <button
                  onClick={() => testMutation.mutate({ type: 'redis', config: config.redis })}
                  disabled={testMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </button>
              </div>

              {testMutation.isSuccess && testMutation.data && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {testMutation.data.message}
                  </span>
                </div>
              )}

              {testMutation.isError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Connection failed
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Backup & Restore</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Create Backup
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Create a backup of all configuration settings
                  </p>
                  <button
                    onClick={() => backupMutation.mutate()}
                    disabled={backupMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {backupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Create Backup
                  </button>
                  
                  {backupMutation.isSuccess && backupMutation.data && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Backup created: {backupMutation.data.path}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Restore from Backup
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Restore configuration from a previous backup
                  </p>
                  <button
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Backup File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You have unsaved changes
          </p>
          <div className="space-x-3">
            <button
              onClick={() => {
                setConfig(configData);
                setHasChanges(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}