'use client';

import { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  ArrowLeftRight,
  Users,
  Building2,
} from 'lucide-react';

type ConnectionStatus = 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

interface IntegrationCardProps {
  id: string;
  type: 'WORDPRESS' | 'WOOCOMMERCE' | 'GOOGLE' | 'CMS_VOLER';
  name: string;
  status: ConnectionStatus;
  description?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  onTest?: () => Promise<void>;
  onConfigure?: () => void;
  onDelete?: () => Promise<void>;
  onTransfer?: () => void;
  onManageSharing?: () => void;
  onTransferOrg?: () => void;
  onOpenDashboard?: () => Promise<void>;
  disabled?: boolean;
  upgradeRequired?: boolean;
  sharedProjectsCount?: number;
}

const STATUS_CONFIG: Record<ConnectionStatus, {
  color: string;
  bgColor: string;
  icon: typeof CheckCircle;
  label: string;
}> = {
  ACTIVE: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    icon: CheckCircle,
    label: 'Connesso',
  },
  PENDING: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Clock,
    label: 'In attesa',
  },
  TESTING: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: RefreshCw,
    label: 'Test in corso',
  },
  ERROR: {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: AlertCircle,
    label: 'Errore',
  },
  DISABLED: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    icon: Clock,
    label: 'Disabilitato',
  },
};

const TYPE_CONFIG: Record<string, {
  icon: string;
  gradient: string;
}> = {
  WORDPRESS: {
    icon: '📝',
    gradient: 'from-blue-500 to-blue-600',
  },
  WOOCOMMERCE: {
    icon: '🛒',
    gradient: 'from-purple-500 to-purple-600',
  },
  GOOGLE: {
    icon: '🔍',
    gradient: 'from-red-500 to-yellow-500',
  },
  CMS_VOLER: {
    icon: '🚀',
    gradient: 'from-amber-500 to-orange-600',
  },
};

export function IntegrationCard({
  id,
  type,
  name,
  status,
  description,
  lastSyncAt,
  lastError,
  onTest,
  onConfigure,
  onDelete,
  onTransfer,
  onManageSharing,
  onTransferOrg,
  onOpenDashboard,
  disabled = false,
  upgradeRequired = false,
  sharedProjectsCount = 0,
}: IntegrationCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);

  const statusConfig = STATUS_CONFIG[status];
  const typeConfig = TYPE_CONFIG[type];
  const StatusIcon = statusConfig.icon;

  const handleTest = async () => {
    if (!onTest || isTesting) return;
    setIsTesting(true);
    try {
      await onTest();
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    if (!confirm('Sei sicuro di voler eliminare questa connessione?')) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenDashboard = async () => {
    if (!onOpenDashboard || isOpeningDashboard) return;
    setIsOpeningDashboard(true);
    try {
      await onOpenDashboard();
    } finally {
      setIsOpeningDashboard(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-6 transition-all ${disabled ? 'opacity-60' : 'hover:border-gray-300'
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center text-2xl`}
          >
            {typeConfig.icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
        >
          <StatusIcon
            className={`w-3.5 h-3.5 ${status === 'TESTING' ? 'animate-spin' : ''}`}
          />
          {statusConfig.label}
        </div>
      </div>

      {/* Error Message */}
      {status === 'ERROR' && lastError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{lastError}</p>
        </div>
      )}

      {/* Upgrade Banner */}
      {upgradeRequired && (
        <div className="mb-4 p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white">
          <p className="text-sm font-medium">
            Upgrade a BUSINESS per abilitare questa integrazione
          </p>
        </div>
      )}

      {/* Last Sync */}
      {lastSyncAt && (
        <p className="text-xs text-gray-400 mb-4">
          Ultimo sync: {new Date(lastSyncAt).toLocaleString('it-IT')}
        </p>
      )}

      {/* Actions */}
      {!disabled && !upgradeRequired && (
        <div className="space-y-2 pt-4 border-t border-gray-100">
          {/* Multi-project sharing info */}
          {sharedProjectsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="text-indigo-700 font-medium">
                Condivisa con {sharedProjectsCount} {sharedProjectsCount === 1 ? 'progetto' : 'progetti'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {onOpenDashboard && (
              <button
                onClick={handleOpenDashboard}
                disabled={isOpeningDashboard}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                <ExternalLink className={`w-4 h-4 ${isOpeningDashboard ? 'animate-pulse' : ''}`} />
                {isOpeningDashboard ? 'Apertura...' : 'Apri Dashboard'}
              </button>
            )}

            {onTest && (
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Test...' : 'Testa'}
              </button>
            )}

            {onConfigure && (
              <button
                onClick={onConfigure}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configura
              </button>
            )}

            {onManageSharing && (
              <button
                onClick={onManageSharing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                title="Gestisci condivisione progetti"
              >
                <Users className="w-4 h-4" />
                Condividi
              </button>
            )}

            {onTransferOrg && (
              <button
                onClick={onTransferOrg}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                title="Trasferisci ad altra organizzazione"
              >
                <Building2 className="w-4 h-4" />
              </button>
            )}

            {onTransfer && (
              <button
                onClick={onTransfer}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                title="Trasferisci in un altro progetto"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connect Button for non-configured */}
      {disabled && !upgradeRequired && (
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={onConfigure}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Connetti
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upgrade Button */}
      {upgradeRequired && (
        <div className="pt-4 border-t border-gray-100">
          <a
            href="/dashboard/settings/billing"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Upgrade
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
