import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { sql, desc } from 'drizzle-orm'
import { getDb, tests } from '../../db'

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

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'REJECTED':
      return <XCircle className="w-5 h-5 text-red-500" />
    case 'PENDING':
      return <Clock className="w-5 h-5 text-yellow-500" />
    default:
      return <Clock className="w-5 h-5 text-gray-400" />
  }
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

function BranchesIndex() {
  const branches = Route.useLoaderData()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <p className="mt-1 text-sm text-gray-500">
          View visual testing status by branch
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {branches.map((branch) => (
            <li key={branch.name}>
              <Link
                to="/branches/$name"
                params={{ name: encodeURIComponent(branch.name) }}
                className="block hover:bg-gray-50"
              >
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GitBranch className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {branch.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {branch.testCount} test
                        {branch.testCount !== 1 ? 's' : ''} &middot; Last run{' '}
                        {formatRelativeTime(branch.lastTest.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusIcon status={branch.lastTest.status} />
                    <span className="text-sm text-gray-500 font-mono">
                      {branch.lastTest.commitHash}
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
