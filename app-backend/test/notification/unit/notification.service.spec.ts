import "reflect-metadata"
import { NotificationService } from "@features/notification/application/notification.service"
import type { IEmailQueue } from "@shared/core/queue.interface"
import { createMockLogger, createMockEmailQueue } from "../../utils/mock-factories"

import type { NotificationLogRepository } from "@features/notification/infrastructure/notification-log.repository"

describe("NotificationService (알림 서비스)", () => {
    let service: NotificationService
    let logRepository: jest.Mocked<NotificationLogRepository>
    let logger: ReturnType<typeof createMockLogger>
    let emailQueue: jest.Mocked<IEmailQueue>

    beforeEach(() => {
        jest.clearAllMocks()

        logRepository = {
            createLog: jest.fn().mockResolvedValue({ id: "uuid-42" }),
            updateStatus: jest.fn(),
        } as unknown as jest.Mocked<NotificationLogRepository>

        logger = createMockLogger()
        emailQueue = createMockEmailQueue()
        service = new NotificationService(logger, logRepository, emailQueue)
    })

    describe("send (이메일 발송)", () => {
        it("로그를 생성하고 큐에 데이터를 추가한다", async () => {
            // When
            await service.send("user@example.com", "제목", "본문 내용")

            // Then — 로그 생성
            expect(logRepository.createLog).toHaveBeenCalledWith({
                recipient: "user@example.com",
                subject: "제목",
                content: "본문 내용", // escapeHtml은 일반 텍스트를 변경하지 않음
            })

            // Then — 큐에 평문 데이터 추가 (암호화는 어댑터에서 처리)
            expect(emailQueue.enqueue).toHaveBeenCalledWith({
                to: "user@example.com",
                subject: "제목",
                content: "본문 내용",
                logId: "uuid-42",
            })
        })

        it("HTML 콘텐츠를 이스케이프한다", async () => {
            // When
            await service.send("user@example.com", "제목", "<script>alert('xss')</script>")

            // Then — escapeHtml이 적용된 content가 로그에 저장
            expect(logRepository.createLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.not.stringContaining("<script>"),
                })
            )
        })

        it("발송 후 info 로그를 기록한다", async () => {
            await service.send("user@test.com", "제목", "본문")

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("user@test.com")
            )
        })
    })
})
