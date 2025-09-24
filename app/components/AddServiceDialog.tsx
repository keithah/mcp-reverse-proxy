'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

interface AddServiceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddServiceDialog({ open, onClose }: AddServiceDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    entryPoint: '',
    proxyPath: '',
    environment: '',
    autoStart: true,
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          repository: {
            entryPoint: data.entryPoint,
            path: './',
          },
          environment: data.environment ? JSON.parse(data.environment) : {},
          proxy: {
            path: data.proxyPath,
          },
          process: {},
          autoStart: data.autoStart,
        }),
      });
      if (!res.ok) throw new Error('Failed to create service');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
      setFormData({
        name: '',
        entryPoint: '',
        proxyPath: '',
        environment: '',
        autoStart: true,
      });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Add New Service
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Service Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Entry Point
              </label>
              <input
                type="text"
                required
                placeholder="index.js"
                value={formData.entryPoint}
                onChange={(e) => setFormData({ ...formData, entryPoint: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Proxy Path
              </label>
              <input
                type="text"
                required
                placeholder="/mcp/my-service"
                value={formData.proxyPath}
                onChange={(e) => setFormData({ ...formData, proxyPath: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Environment Variables (JSON)
              </label>
              <textarea
                placeholder='{"API_KEY": "value"}'
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                rows={3}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoStart"
                checked={formData.autoStart}
                onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoStart" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Auto-start service
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {mutation.isPending ? 'Creating...' : 'Create Service'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}