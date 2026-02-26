import { injectable, singleton, inject } from "tsyringe"
import { Response } from "express"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { ILogger } from "@shared/core/logger.interface"
import { IRealtimeNotifier, SSEConnection } from "@shared/core/realtime-notifier.interface"

/** 사용자당 최대 SSE 연결 수 */
const MAX_CONNECTIONS_PER_USER = 2
/** 전체 최대 SSE 연결 수 */
const MAX_TOTAL_CONNECTIONS = 2000
/** Heartbeat 주기 (ms) — 프록시 타임아웃 방지 */
const HEARTBEAT_INTERVAL_MS = 30_000

@injectable()
@singleton()
export class SSENotificationService implements IRealtimeNotifier {
    /** userId → 연결 Set */
    private userClients: Map<number, Set<SSEConnection>> = new Map()
    /** admin 브로드캐스트용 (userId 없는 레거시 연결) */
    private adminClients: Set<SSEConnection> = new Set()
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private totalConnections = 0

    constructor(@inject(DI_TOKENS.ILogger) private logger: ILogger) {
        this.startHeartbeat()
    }

    /**
     * userId 기반 SSE 연결 등록
     * - 사용자당 최대 MAX_CONNECTIONS_PER_USER개
     * - 전체 최대 MAX_TOTAL_CONNECTIONS개
     */
    addClient(userId: number, connection: SSEConnection): void {
        // 전체 연결 제한
        if (this.totalConnections >= MAX_TOTAL_CONNECTIONS) {
            this.logger.warn(
                `[SSE] 전체 연결 제한 도달 (${MAX_TOTAL_CONNECTIONS}) — userId=${userId} 거부`
            )
            connection.end()
            return
        }

        let userSet = this.userClients.get(userId)
        if (!userSet) {
            userSet = new Set()
            this.userClients.set(userId, userSet)
        }

        // 사용자당 연결 제한 — 오래된 연결 제거
        if (userSet.size >= MAX_CONNECTIONS_PER_USER) {
            const oldest = userSet.values().next().value
            if (oldest) {
                this.removeClient(userId, oldest)
                oldest.end()
            }
        }

        userSet.add(connection)
        this.totalConnections++

        connection.on("close", () => {
            this.removeClient(userId, connection)
        })

        this.logger.info(
            `[SSE] 연결 추가 userId=${userId} (사용자: ${userSet.size}, 전체: ${this.totalConnections})`
        )
    }

    /**
     * admin 브로드캐스트용 연결 추가 (레거시 호환)
     * Express Response를 직접 받아 SSEConnection으로 사용 (구조적 타이핑)
     */
    addAdminClient(res: Response): void {
        this.adminClients.add(res)

        res.on("close", () => {
            this.adminClients.delete(res)
        })
    }

    /**
     * 특정 사용자에게 이벤트 전송
     */
    notifyUser(userId: number, event: string, data: unknown): void {
        const userSet = this.userClients.get(userId)
        // 의도적 skip: 해당 사용자의 SSE 연결이 없으면 전송 불필요
        if (!userSet || userSet.size === 0) return

        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

        for (const client of userSet) {
            if (!this.writeToClient(client, payload, `notifyUser userId=${userId}`)) {
                this.removeClient(userId, client)
            }
        }
    }

    /**
     * 전체 브로드캐스트 (admin 모니터링용 + 전체 사용자)
     */
    notifyAll(event: string, data: unknown): void {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

        // admin 클라이언트 전송
        for (const client of this.adminClients) {
            if (!this.writeToClient(client, payload, "notifyAll admin")) {
                this.adminClients.delete(client)
            }
        }

        // 전체 사용자 클라이언트 전송
        for (const [userId, userSet] of this.userClients) {
            for (const client of userSet) {
                if (!this.writeToClient(client, payload, `notifyAll userId=${userId}`)) {
                    this.removeClient(userId, client)
                }
            }
        }
    }

    /**
     * 활성 연결 수 (사용자 + admin)
     */
    get clientCount(): number {
        return this.totalConnections + this.adminClients.size
    }

    /**
     * 사용자 연결 제거 헬퍼
     */
    private removeClient(userId: number, connection: SSEConnection): void {
        const userSet = this.userClients.get(userId)
        // 의도적 skip: 이미 제거된 사용자 연결 — 중복 호출 무시
        if (!userSet) return

        if (userSet.delete(connection)) {
            this.totalConnections--
        }

        if (userSet.size === 0) {
            this.userClients.delete(userId)
        }
    }

    /**
     * SSE 클라이언트에 데이터 쓰기
     * - 연결이 종료/파괴된 클라이언트는 skip
     * - write 실패 시 false 반환 → 호출부에서 클라이언트 제거
     */
    private writeToClient(client: SSEConnection, payload: string, context: string): boolean {
        try {
            if (client.writableEnded || client.destroyed) {
                return false
            }
            client.write(payload)
            return true
        } catch (err: unknown) {
            this.logger.warn(
                `[SSE] ${context} 실패: ${err instanceof Error ? err.message : String(err)}`
            )
            return false
        }
    }

    /**
     * Heartbeat — 프록시/로드밸런서 타임아웃 방지
     */
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            const comment = `:heartbeat\n\n`

            // 사용자 클라이언트 heartbeat
            for (const [userId, userSet] of this.userClients) {
                for (const client of userSet) {
                    if (!this.writeToClient(client, comment, `heartbeat userId=${userId}`)) {
                        this.removeClient(userId, client)
                    }
                }
            }

            // admin 클라이언트 heartbeat
            for (const client of this.adminClients) {
                if (!this.writeToClient(client, comment, "heartbeat admin")) {
                    this.adminClients.delete(client)
                }
            }
        }, HEARTBEAT_INTERVAL_MS)

        // unref — 앱 종료 시 heartbeat 타이머가 프로세스를 블로킹하지 않도록
        this.heartbeatTimer.unref()
    }
}
