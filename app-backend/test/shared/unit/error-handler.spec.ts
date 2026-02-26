import "reflect-metadata"
import { container } from "tsyringe"
import { createMockLogger } from "../../utils/mock-factories"
import type { ILogger } from "@shared/core/logger.interface"
import type { Request, Response, NextFunction } from "express"

// tsyringe container mock
jest.mock("tsyringe", () => ({
    container: {
        resolve: jest.fn(),
    },
}))

import { globalErrorHandler } from "@shared/presentation/middlewares/error.handler"
import {
    ValidationException,
    UnauthorizedException,
    ForbiddenException,
} from "@shared/core/exceptions/domain-exceptions"
import { ServiceUnavailableException } from "@shared/core/exceptions/infrastructure-exceptions"
import { ErrorCodes } from "@shared/core/constants/error-codes"

describe("globalErrorHandler (전역 에러 핸들러)", () => {
    let mockLogger: jest.Mocked<ILogger>
    let mockReq: Partial<Request> & { t?: jest.Mock }
    let mockRes: Partial<Response>
    let mockNext: NextFunction

    beforeEach(() => {
        mockLogger = createMockLogger()
        ;(container.resolve as jest.Mock).mockReturnValue(mockLogger)

        mockReq = {
            method: "GET",
            originalUrl: "/api/v1/test",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t: jest.fn((key: string) => key) as any,
        }

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        }

        mockNext = jest.fn()
    })

    describe("ServiceUnavailableException 처리", () => {
        it("503 상태 코드와 SERVICE_UNAVAILABLE 에러 코드를 반환한다", () => {
            // Given
            const error = new ServiceUnavailableException("Redis")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(503)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "error.service_unavailable",
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
            })
        })

        it("에러 로그를 기록한다", () => {
            // Given
            const error = new ServiceUnavailableException("Redis")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Service Unavailable"),
                error,
                { method: "GET", url: "/api/v1/test" }
            )
        })
    })

    describe("ValidationException 처리", () => {
        it("400 상태 코드와 에러 정보를 반환한다", () => {
            // Given
            const error = new ValidationException(
                "validation.email_invalid",
                ErrorCodes.VALIDATION_ERROR
            )

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(400)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "validation.email_invalid",
                errorCode: ErrorCodes.VALIDATION_ERROR,
                errorKey: "validation.email_invalid",
            })
        })

        it("i18n 번역 함수를 호출한다", () => {
            // Given
            const error = new ValidationException("validation.email_invalid")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockReq.t).toHaveBeenCalledWith("validation.email_invalid")
        })

        it("경고 로그를 기록한다", () => {
            // Given
            const error = new ValidationException("validation.email_invalid")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Domain Exception"),
                expect.objectContaining({
                    method: "GET",
                    url: "/api/v1/test",
                    type: "ValidationException",
                    statusCode: 400,
                })
            )
        })
    })

    describe("UnauthorizedException 처리", () => {
        it("401 상태 코드를 반환한다", () => {
            // Given
            const error = new UnauthorizedException(
                "auth.invalid_credentials",
                ErrorCodes.INVALID_CREDENTIALS
            )

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(401)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "auth.invalid_credentials",
                errorCode: ErrorCodes.INVALID_CREDENTIALS,
                errorKey: "auth.invalid_credentials",
            })
        })
    })

    describe("ForbiddenException 처리", () => {
        it("403 상태 코드를 반환한다", () => {
            // Given
            const error = new ForbiddenException("auth.access_denied", "FORBIDDEN")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(403)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "auth.access_denied",
                errorCode: "FORBIDDEN",
                errorKey: "auth.access_denied",
            })
        })
    })

    describe("metadata 전달", () => {
        it("DomainException에 metadata가 있으면 응답에 포함한다", () => {
            // Given
            const metadata = { field: "email", constraint: "unique" }
            const error = new ValidationException(
                "validation.duplicate",
                ErrorCodes.VALIDATION_ERROR,
                metadata
            )

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { field: "email", constraint: "unique" },
                })
            )
        })

        it("DomainException에 metadata가 없으면 응답에 포함하지 않는다", () => {
            // Given
            const error = new ValidationException("validation.required")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            const responseBody = (mockRes.json as jest.Mock).mock.calls[0][0]
            expect(responseBody).not.toHaveProperty("metadata")
        })
    })

    describe("JSON 파싱 에러 (SyntaxError) 처리", () => {
        it("status 400인 SyntaxError는 400과 VALIDATION_ERROR를 반환한다", () => {
            // Given
            const error = new SyntaxError("Unexpected token } in JSON at position 1")
            ;// eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(error as any).status = 400

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(400)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "error.invalid_json",
                errorCode: ErrorCodes.VALIDATION_ERROR,
                errorKey: "error.invalid_json",
            })
        })

        it("req.t가 없으면 기본 영문 메시지를 반환한다", () => {
            // Given
            const error = new SyntaxError("Unexpected token } in JSON at position 1")
            ;// eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(error as any).status = 400
            const reqWithoutT = { method: "POST", originalUrl: "/api/v1/test" } as Partial<Request>

            // When
            globalErrorHandler(error, reqWithoutT, mockRes, mockNext)

            // Then
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Invalid JSON in request body",
                })
            )
        })
    })

    describe("알 수 없는 에러 처리", () => {
        it("500 상태 코드와 INTERNAL_ERROR를 반환한다", () => {
            // Given
            const error = new Error("unexpected failure")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.status).toHaveBeenCalledWith(500)
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: "error.default",
                errorCode: ErrorCodes.INTERNAL_ERROR,
                errorKey: "error.default",
            })
        })

        it("에러 로그를 기록한다", () => {
            // Given
            const error = new Error("unexpected failure")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Unhandled Exception"),
                error,
                { method: "GET", url: "/api/v1/test" }
            )
        })
    })

    describe("req.t가 없는 경우 (i18n 미들웨어 미적용)", () => {
        beforeEach(() => {
            mockReq = {
                method: "GET",
                originalUrl: "/api/v1/test",
                // t 함수 없음
            }
        })

        it("ServiceUnavailableException은 기본 영문 메시지를 반환한다", () => {
            // Given
            const error = new ServiceUnavailableException("Redis")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Service temporarily unavailable",
                })
            )
        })

        it("DomainException은 원본 에러 메시지를 반환한다", () => {
            // Given
            const error = new ValidationException("validation.email_invalid")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "validation.email_invalid",
                })
            )
        })

        it("알 수 없는 에러는 기본 영문 메시지를 반환한다", () => {
            // Given
            const error = new Error("something went wrong")

            // When
            globalErrorHandler(error, mockReq as any, mockRes as any, mockNext)

            // Then
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Internal Server Error",
                })
            )
        })
    })
})
