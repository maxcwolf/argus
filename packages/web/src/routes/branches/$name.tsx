import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft, GitBranch, Hash } from 'lucide-react'
import { eq, desc } from 'drizzle-orm'
import { getDb, tests } from '../../db'
import { formatRelativeTime } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'

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
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Branches
        </Link>

        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{branchName}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {stats.total} test{stats.total !== 1 ? 's' : ''} on this branch
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tests</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="text-sm font-medium text-warning-600 dark:text-warning-400">Pending</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-warning-600 dark:text-warning-400">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="text-sm font-medium text-success-600 dark:text-success-400">Approved</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-success-600 dark:text-success-400">
            {stats.approved}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="text-sm font-medium text-error-600 dark:text-error-400">Rejected</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-error-600 dark:text-error-400">
            {stats.rejected}
          </div>
        </div>
      </div>

      {/* Tests List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Test History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Commit
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Changes
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Created
                </th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                        {test.commitHash}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs truncate">
                      {test.commitMessage}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm hidden md:table-cell">
                    <div className="flex items-center gap-4">
                      <span className="text-warning-600 dark:text-warning-400">
                        {test.changedCount} changed
                      </span>
                      <span className="text-success-600 dark:text-success-400">
                        {test.passedCount} passed
                      </span>
                      {test.failedCount > 0 && (
                        <span className="text-error-600 dark:text-error-400">
                          {test.failedCount} failed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                    {formatRelativeTime(test.createdAt)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to="/tests/$id"
                      params={{ id: test.id }}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300"
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
