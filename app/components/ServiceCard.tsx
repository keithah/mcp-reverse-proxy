'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, RefreshCw, Trash2, Settings, Activity, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { ServiceDetailsDialog } from './ServiceDetailsDialog';

interface ServiceCardProps {
  service: any;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/services/${service.id}/start`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to start service');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/services/${service.id}/stop`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to stop service');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/services/${service.id}/restart`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to restart service');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete service');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      case 'crashed':
        return 'text-red-600 bg-red-100';
      case 'restarting':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4" />;
      case 'crashed':
        return <AlertCircle className="h-4 w-4" />;
      case 'restarting':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  const isLoading = startMutation.isPending || stopMutation.isPending || 
                   restartMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              {service.name}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
              {getStatusIcon(service.status)}
              <span className="ml-1">{service.status}</span>
            </span>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            <p className="truncate">Path: {service.proxyPath}</p>
            {service.metrics && (
              <div className="mt-2 space-y-1">
                <p>PID: {service.metrics.pid}</p>
                <p>Uptime: {Math.floor(service.metrics.uptime / 1000)}s</p>
                <p>Restarts: {service.metrics.restartCount}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            {service.status === 'stopped' ? (
              <button
                onClick={() => startMutation.mutate()}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </button>
            ) : (
              <button
                onClick={() => stopMutation.mutate()}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </button>
            )}
            
            <button
              onClick={() => restartMutation.mutate()}
              disabled={isLoading || service.status === 'stopped'}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
              Restart
            </button>
            
            <button
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <Settings className="h-3 w-3 mr-1" />
              Details
            </button>
            
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${service.name}?`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      
      <ServiceDetailsDialog
        service={service}
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </>
  );
}