import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GitBranch, Hash } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { getDb, tests } from '../../db'
import { formatRelativeTime } from '../../lib/utils'
import { StatusBadge } from '../../components/ui/StatusBadge'

const getAllTests = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  const allTests = await db
    .select()
    .from(tests)
    .orderBy(desc(tests.createdAt))
    .limit(50)

  return allTests.map((test) => ({
    ...test,
    createdAt: test.createdAt.toISOString(),
  }))
})

export const Route = createFileRoute('/tests/')({
  component: TestsIndex,
  loader: () => getAllTests(),
})

function TestsIndex() {
  const tests = Route.useLoaderData()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Tests</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View all visual regression test runs
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
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
                      <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                        {test.branch}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      vs {test.baseBranch}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400" />
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
