import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GitBranch, ChevronRight } from 'lucide-react'
import { sql, desc } from 'drizzle-orm'
import { getDb, tests } from '../../db'
import { formatRelativeTime } from '../../lib/utils'
import { StatusIcon } from '../../components/ui/StatusBadge'

const getBranches = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()

  // Get unique branches with their latest test
  const branchData = await db
    .select({
      branch: tests.branch,
      testCount: sql<number>`count(*)`.as('test_count'),
    })
    .from(tests)
    .groupBy(tests.branch)

  // Get the latest test for each branch
  const branches = await Promise.all(
    branchData.map(async (b) => {
      const [latestTest] = await db
        .select()
        .from(tests)
        .where(sql`${tests.branch} = ${b.branch}`)
        .orderBy(desc(tests.createdAt))
        .limit(1)

      return {
        name: b.branch,
        lastTest: latestTest
          ? {
              id: latestTest.id,
              status: latestTest.status,
              commitHash: latestTest.commitHash,
              createdAt: latestTest.createdAt.toISOString(),
            }
          : null,
        testCount: Number(b.testCount),
      }
    })
  )

  return branches.filter((b) => b.lastTest !== null)
})

export const Route = createFileRoute('/branches/')({
  component: BranchesIndex,
  loader: () => getBranches(),
})

function BranchesIndex() {
  const branches = Route.useLoaderData()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branches</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View visual testing status by branch
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {branches.map((branch) => (
            <li key={branch.name}>
              <Link
                to="/branches/$name"
                params={{ name: encodeURIComponent(branch.name) }}
                className="block hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <GitBranch className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {branch.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {branch.testCount} test
                        {branch.testCount !== 1 ? 's' : ''} &middot; Last run{' '}
                        {formatRelativeTime(branch.lastTest!.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-2">
                    <StatusIcon status={branch.lastTest!.status} />
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono hidden sm:inline">
                      {branch.lastTest!.commitHash}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
