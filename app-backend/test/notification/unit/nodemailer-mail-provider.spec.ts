import "reflect-metadata"
import { NodemailerMailProvider } from "@features/notification/infrastructure/mail/nodemailer-mail-provider"
import { createMockLogger, createMockConfigServiceWithMail } from "../../utils/mock-factories"
import * as nodemailer from "nodemailer"

jest.mock("nodemailer")

describe("NodemailerMailProvider", () => {
    let provider: NodemailerMailProvider
    let configServiceMock: ReturnType<typeof createMockConfigServiceWithMail>
    let loggerMock: ReturnType<typeof createMockLogger>
    let sendMailMock: jest.Mock

    beforeEach(() => {
        configServiceMock = createMockConfigServiceWithMail()
        loggerMock = createMockLogger()
        sendMailMock = jest.fn().mockResolvedValue("Email sent")
        ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: sendMailMock,
        })

        provider = new NodemailerMailProvider(configServiceMock, loggerMock)
    })

    it("인스턴스가 생성되어야 한다", () => {
        expect(provider).toBeDefined()
    })

    it("자격증명이 있으면 transporter를 구성해야 한다", () => {
        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            service: "gmail",
            auth: {
                user: "test@gmail.com",
                pass: "password123",
            },
        })
        expect(provider["isConfigured"]).toBe(true)
    })

    it("이메일을 성공적으로 전송해야 한다", async () => {
        await provider.send("recipient@example.com", "Test Subject", "<p>Test Content</p>")
        expect(sendMailMock).toHaveBeenCalledWith({
            from: "test@gmail.com",
            to: "recipient@example.com",
            subject: "Test Subject",
            html: "<p>Test Content</p>",
            text: "Test Content",
        })
        expect(loggerMock.info).toHaveBeenCalledWith(
            expect.stringContaining("Email sent via Nodemailer")
        )
    })

    it("미설정 시 콘솔 폴백으로 경고 로그를 남겨야 한다", async () => {
        const unconfigured = createMockConfigServiceWithMail({ user: undefined })
        provider = new NodemailerMailProvider(unconfigured, loggerMock)

        await provider.send("recipient@example.com", "Test", "Content")

        expect(sendMailMock).not.toHaveBeenCalled()
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.stringContaining("Nodemailer not configured")
        )
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("[CONSOLE FALLBACK]"))
    })
})
