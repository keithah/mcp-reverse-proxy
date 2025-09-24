'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Shield, Wifi, Globe, Lock, AlertCircle, CheckCircle, Router, Key } from 'lucide-react';

interface NetworkStatus {
  network: {
    publicIP?: string;
    privateIP?: string;
    upnpEnabled: boolean;
    mappedPorts: Array<{ protocol: string; public: number; private: number; description: string }>;
    ports: {
      backend: number;
      frontend: number;
      https: number;
    };
  };
  portForwarding: Array<{ port: number; open: boolean }>;
  ssl: {
    enabled: boolean;
    domain?: string;
  };
}

export function NetworkConfigPanel() {
  const queryClient = useQueryClient();
  const [sslConfig, setSSLConfig] = useState({
    enabled: false,
    domain: '',
    email: '',
    provider: 'letsencrypt',
  });

  const { data: status, isLoading } = useQuery<NetworkStatus>({
    queryKey: ['network-status'],
    queryFn: async () => {
      const res = await fetch('/api/network/status', {
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch network status');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const sslMutation = useMutation({
    mutationFn: async (config: any) => {
      const res = await fetch('/api/network/ssl/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to configure SSL');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-status'] });
    },
  });

  const checkPortsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/network/upnp/check-ports', {
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '' },
      });
      if (!res.ok) throw new Error('Failed to check ports');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-status'] });
    },
  });

  const generateSelfSignedMutation = useMutation({
    mutationFn: async (domain: string) => {
      const res = await fetch('/api/network/ssl/generate-self-signed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) throw new Error('Failed to generate certificate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-status'] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Network Status
          </h3>
          <button
            onClick={() => checkPortsMutation.mutate()}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Check Ports
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Public IP</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300 font-mono">
              {status?.network.publicIP || 'Not detected'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Private IP</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300 font-mono">
              {status?.network.privateIP || 'Not detected'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Backend Port</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">
              {status?.network.ports.backend}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">HTTPS Port</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-300">
              {status?.network.ports.https}
            </dd>
          </div>
        </dl>
      </div>

      {/* Port Forwarding Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center mb-4">
          <Router className="h-5 w-5 mr-2" />
          Port Forwarding
        </h3>

        <div className="space-y-2">
          {status?.portForwarding.map((port) => (
            <div key={port.port} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-300">
                Port {port.port}
              </span>
              <span className="flex items-center">
                {port.open ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-green-600 dark:text-green-400">Open</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">Closed</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        {status?.network.upnpEnabled && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="flex">
              <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  UPnP Enabled
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Automatic port mapping is active. Ports are being forwarded via UPnP.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SSL Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center mb-4">
          <Shield className="h-5 w-5 mr-2" />
          SSL/HTTPS Configuration
        </h3>

        {status?.ssl.enabled ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
            <div className="flex">
              <Lock className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-300">
                  HTTPS Enabled
                </h4>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Domain: {status.ssl.domain || 'Self-signed certificate'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SSL Provider
              </label>
              <select
                value={sslConfig.provider}
                onChange={(e) => setSSLConfig({ ...sslConfig, provider: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="letsencrypt">Let's Encrypt</option>
                <option value="self-signed">Self-Signed</option>
              </select>
            </div>

            {sslConfig.provider === 'letsencrypt' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={sslConfig.domain}
                    onChange={(e) => setSSLConfig({ ...sslConfig, domain: e.target.value })}
                    placeholder="example.com"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={sslConfig.email}
                    onChange={(e) => setSSLConfig({ ...sslConfig, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={() => sslMutation.mutate({ ...sslConfig, enabled: true })}
                  disabled={!sslConfig.domain || !sslConfig.email || sslMutation.isPending}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {sslMutation.isPending ? 'Configuring...' : 'Enable Let\'s Encrypt'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Domain (for certificate)
                  </label>
                  <input
                    type="text"
                    value={sslConfig.domain}
                    onChange={(e) => setSSLConfig({ ...sslConfig, domain: e.target.value })}
                    placeholder="localhost or your-domain.com"
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={() => generateSelfSignedMutation.mutate(sslConfig.domain || 'localhost')}
                  disabled={generateSelfSignedMutation.isPending}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateSelfSignedMutation.isPending ? 'Generating...' : 'Generate Self-Signed Certificate'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}