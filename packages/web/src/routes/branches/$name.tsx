import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  ArrowLeft,
  GitBranch,
  Hash,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { eq, desc } from 'drizzle-orm'
import { getDb, tests } from '../../db'

const getBranchTests = createServerFn({ method: 'GET' })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const branchName = decodeURIComponent(data.name)
    const db = getDb()

    const branchTests = await db
      .select()
      .from(tests)
      .where(eq(tests.branch, branchName))
      .orderBy(desc(tests.createdAt))

    return {
      branchName,
      tests: branchTests.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
    }
  })

export const Route = createFileRoute('/branches/$name')({
  component: BranchDetail,
  loader: ({ params }) => getBranchTests({ data: { name: params.name } }),
})

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    PARTIAL: 'bg-blue-100 text-blue-800',
  }

  const icons = {
    PENDING: <Clock className="w-4 h-4" />,
    APPROVED: <CheckCircle className="w-4 h-4" />,
    REJECTED: <XCircle className="w-4 h-4" />,
    PARTIAL: <Clock className="w-4 h-4" />,
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.PENDING}`}
    >
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  )
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function BranchDetail() {
  const { branchName, tests } = Route.useLoaderData()

  const stats = {
    total: tests.length,
    pending: tests.filter((t) => t.status === 'PENDING').length,
    approved: tests.filter((t) => t.status === 'APPROVED').length,
    rejected: tests.filter((t) => t.status === 'REJECTED').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to="/branches"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Branches
        </Link>

        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">{branchName}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {stats.total} test{stats.total !== 1 ? 's' : ''} on this branch
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Tests</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {stats.total}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-yellow-600">Pending</div>
          <div className="mt-2 text-3xl font-bold text-yellow-600">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-green-600">Approved</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {stats.approved}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-red-600">Rejected</div>
          <div className="mt-2 text-3xl font-bold text-red-600">
            {stats.rejected}
          </div>
        </div>
      </div>

      {/* Tests List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Test History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Changes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-mono text-gray-600">
                        {test.commitHash}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                      {test.commitMessage}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-yellow-600">
                        {test.changedCount} changed
                      </span>
                      <span className="text-green-600">
                        {test.passedCount} passed
                      </span>
                      {test.failedCount > 0 && (
                        <span className="text-red-600">
                          {test.failedCount} failed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatRelativeTime(test.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to="/tests/$id"
                      params={{ id: test.id }}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
