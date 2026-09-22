import type { AnyContractRouter } from '@orpc/contract'
import type { Router } from '@orpc/server'
import { onTestFinished } from 'vitest'
import { connect, serve, type Client } from '@/shared/rpc/rpc'

type TestPort = InstanceType<typeof MessageChannel>['port1']

export type Channel<C extends AnyContractRouter> = { client: Client<C>; clientPort: TestPort; hostPort: TestPort }

/**
 * Serves `router` on one end of a fresh Node MessageChannel and connects a client for contract `C`, named explicitly,
 * to the other. The channel closes when the test finishes.
 */
export function openChannel<C extends AnyContractRouter = never>(
  router: Router<NoInfer<C>, Record<never, never>>,
): Channel<C> {
  const { port1: clientPort, port2: hostPort } = new MessageChannel()
  onTestFinished(() => clientPort.close())
  serve<C>(router, hostPort)

  return { client: connect<C>(clientPort), clientPort, hostPort }
}
