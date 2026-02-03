import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'

export type StatusType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

const statusConfig = {
  PENDING: {
    icon: Clock,
    styles: 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200',
  },
  APPROVED: {
    icon: CheckCircle,
    styles: 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200',
  },
  REJECTED: {
    icon: XCircle,
    styles: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200',
  },
  PARTIAL: {
    icon: Clock,
    styles: 'bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-200',
  },
} as const

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || statusConfig.PENDING
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.styles,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      {status}
    </span>
  )
}

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className={cn('w-5 h-5 text-success-500', className)} />
    case 'REJECTED':
      return <XCircle className={cn('w-5 h-5 text-error-500', className)} />
    case 'PENDING':
      return <Clock className={cn('w-5 h-5 text-warning-500', className)} />
    default:
      return <Clock className={cn('w-5 h-5 text-gray-400', className)} />
  }
}
