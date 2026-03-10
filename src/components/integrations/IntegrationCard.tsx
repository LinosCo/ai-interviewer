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
  Search,
  FileText,
  ShoppingCart,
  Rocket,
  GitBranch,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';

type ConnectionStatus = 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

interface IntegrationCardProps {
  id: string;
  type: 'WORDPRESS' | 'WOOCOMMERCE' | 'BREVO' | 'GOOGLE' | 'CMS_VOLER' | 'N8N';
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
    color: 'text-stone-600',
    bgColor: 'bg-stone-100',
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
    color: 'text-stone-400',
    bgColor: 'bg-stone-100',
    icon: Clock,
    label: 'Disabilitato',
  },
};

const TYPE_CONFIG: Record<IntegrationCardProps['type'], {
  icon: LucideIcon;
  iconClassName: string;
  containerClassName: string;
}> = {
  WORDPRESS: {
    icon: FileText,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
  },
  WOOCOMMERCE: {
    icon: ShoppingCart,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
  },
  BREVO: {
    icon: Mail,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
  },
  GOOGLE: {
    icon: Search,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
  },
  CMS_VOLER: {
    icon: Rocket,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
  },
  N8N: {
    icon: GitBranch,
    iconClassName: 'text-stone-700',
    containerClassName: 'bg-stone-100 border border-stone-200',
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
  const integrationConfirm = useConfirmDialog();

  const statusConfig = STATUS_CONFIG[status];
  const typeConfig = TYPE_CONFIG[type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

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
    const ok = await integrationConfirm.open({
      title: 'Elimina connessione',
      description: 'Sei sicuro di voler eliminare questa connessione?',
      confirmLabel: 'Elimina',
      variant: 'destructive',
    });
    if (!ok) return;
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
      data-connection-id={id}
      className={`bg-white rounded-xl border border-stone-200 p-6 transition-all ${disabled ? 'opacity-60' : 'hover:border-stone-300'
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig.containerClassName}`}
          >
            <TypeIcon className={`w-5 h-5 ${typeConfig.iconClassName}`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-900 truncate">{name}</h3>
            {description && (
              <p className="text-sm text-stone-500 break-words">{description}</p>
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
        <div className="mb-4 p-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white">
          <p className="text-sm font-medium">
            Upgrade a BUSINESS per abilitare questa integrazione
          </p>
        </div>
      )}

      {/* Last Sync */}
      {lastSyncAt && (
        <p className="text-xs text-stone-400 mb-4">
          Ultimo sync: {new Date(lastSyncAt).toLocaleString('it-IT')}
        </p>
      )}

      {/* Actions */}
      {!disabled && !upgradeRequired && (
        <div className="space-y-2 pt-4 border-t border-stone-100">
          {/* Multi-project sharing info */}
          {sharedProjectsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700 font-medium">
                Condivisa con {sharedProjectsCount} {sharedProjectsCount === 1 ? 'progetto' : 'progetti'}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {onOpenDashboard && (
              <button
                onClick={handleOpenDashboard}
                disabled={isOpeningDashboard}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <ExternalLink className={`w-4 h-4 ${isOpeningDashboard ? 'animate-pulse' : ''}`} />
                {isOpeningDashboard ? 'Apertura...' : 'Apri Dashboard'}
              </button>
            )}

            {onTest && (
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Test...' : 'Testa'}
              </button>
            )}

            {onConfigure && (
              <button
                onClick={onConfigure}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                Configura
              </button>
            )}

            {onManageSharing && (
              <button
                onClick={onManageSharing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                title="Gestisci condivisione progetti"
              >
                <Users className="w-4 h-4" />
                Condividi
              </button>
            )}

            {onTransferOrg && (
              <button
                onClick={onTransferOrg}
                className="inline-flex items-center justify-center px-2.5 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                title="Trasferisci ad altra organizzazione"
              >
                <Building2 className="w-4 h-4" />
              </button>
            )}

            {onTransfer && (
              <button
                onClick={onTransfer}
                className="inline-flex items-center justify-center px-2.5 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                title="Trasferisci in un altro progetto"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}

            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center px-2.5 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors sm:ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connect Button for non-configured */}
      {disabled && !upgradeRequired && (
        <div className="pt-4 border-t border-stone-100">
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
        <div className="pt-4 border-t border-stone-100">
          <a
            href="/dashboard/billing"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Upgrade
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      <ConfirmDialog {...integrationConfirm.dialogProps} />
    </div>
  );
}
