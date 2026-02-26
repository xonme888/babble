import "reflect-metadata"
import { EmailVerifiedEventHandler } from "@features/user/handlers/email-verified-event.handler"
import { EmailVerifiedEvent } from "@features/user/domain/events/email-verified.event"
import { createMockLogger, createMockNotificationService } from "../../utils/mock-factories"

describe("User 이벤트 핸들러", () => {
    let mockLogger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        jest.clearAllMocks()
        mockLogger = createMockLogger()
    })

    describe("EmailVerifiedEventHandler (이메일 인증 핸들러)", () => {
        let handler: EmailVerifiedEventHandler
        let mockNotificationService: ReturnType<typeof createMockNotificationService>

        beforeEach(() => {
            mockNotificationService = createMockNotificationService()
            handler = new EmailVerifiedEventHandler(mockNotificationService, mockLogger)
        })

        it("eventType이 'EmailVerifiedEvent'를 반환해야 한다", () => {
            expect(handler.eventType()).toBe("EmailVerifiedEvent")
        })

        it("이벤트 수신 시 환영 이메일을 발송해야 한다", async () => {
            // Given
            const event = new EmailVerifiedEvent(1, "test@example.com")

            // When
            await handler.handle(event)

            // Then
            expect(mockNotificationService.send).toHaveBeenCalledWith(
                "test@example.com",
                expect.stringContaining("Welcome"),
                expect.any(String)
            )
        })

        it("이메일 발송 실패 시 throw하지 않고 error 로그를 남겨야 한다", async () => {
            // Given
            const event = new EmailVerifiedEvent(1, "test@example.com")
            mockNotificationService.send.mockRejectedValue(new Error("SMTP error"))

            // When
            await handler.handle(event)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("[EmailVerifiedEventHandler] 처리 실패"),
                expect.any(Error)
            )
        })
    })
})
