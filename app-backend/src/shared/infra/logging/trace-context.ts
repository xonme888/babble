import { AsyncLocalStorage } from "async_hooks"

export class TraceContext {
    private static storage = new AsyncLocalStorage<string>()

    static run<T>(traceId: string, callback: () => T): T {
        return this.storage.run(traceId, callback)
    }

    static getTraceId(): string | undefined {
        return this.storage.getStore()
    }
}
