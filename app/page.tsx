'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ServiceCard } from './components/ServiceCard';
import { AddServiceDialog } from './components/AddServiceDialog';
import { DeployFromGitHubDialog } from './components/DeployFromGitHubDialog';
import { NetworkConfigPanel } from './components/NetworkConfigPanel';
import { Plus, Github, RefreshCw, Activity, Settings } from 'lucide-react';

export default function Dashboard() {
  const [showAddService, setShowAddService] = useState(false);
  const [showDeployGitHub, setShowDeployGitHub] = useState(false);
  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const queryClient = useQueryClient();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Failed to fetch health');
      return res.json();
    },
  });

  const restartAllMutation = useMutation({
    mutationFn: async () => {
      for (const service of services || []) {
        await fetch(`/api/services/${service.id}/restart`, {
          method: 'POST',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                MCP Reverse Proxy
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {health && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{health.services?.running || 0}</span>
                  <span> / {health.services?.total || 0} running</span>
                </div>
              )}
              <button
                onClick={() => setShowNetworkConfig(!showNetworkConfig)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Settings className="h-4 w-4 mr-2" />
                Network Config
              </button>
              <button
                onClick={() => restartAllMutation.mutate()}
                disabled={restartAllMutation.isPending}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${restartAllMutation.isPending ? 'animate-spin' : ''}`} />
                Restart All
              </button>
              <button
                onClick={() => setShowDeployGitHub(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Github className="h-4 w-4 mr-2" />
                Deploy from GitHub
              </button>
              <button
                onClick={() => setShowAddService(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {showNetworkConfig && (
          <div className="mb-8">
            <NetworkConfigPanel />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : services?.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No services
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding a new service or deploying from GitHub.
            </p>
            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={() => setShowDeployGitHub(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <Github className="h-4 w-4 mr-2" />
                Deploy from GitHub
              </button>
              <button
                onClick={() => setShowAddService(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services?.map((service: any) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </main>

      <AddServiceDialog
        open={showAddService}
        onClose={() => setShowAddService(false)}
      />
      
      <DeployFromGitHubDialog
        open={showDeployGitHub}
        onClose={() => setShowDeployGitHub(false)}
      />
    </div>
  );
}