import "reflect-metadata"
import {
    DomainException,
    ValidationException,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    ForbiddenException,
    EmailNotVerifiedException,
    AccountSuspendedException,
    AccountLockedException,
} from "@shared/core/exceptions/domain-exceptions"
import { ServiceUnavailableException } from "@shared/core/exceptions/infrastructure-exceptions"

describe("DomainException 계층 (단위 테스트)", () => {
    describe("ValidationException", () => {
        it("statusCode 400과 isDomainException=true를 가져야 한다", () => {
            // Given
            const message = "유효하지 않은 입력입니다"

            // When
            const exception = new ValidationException(message)

            // Then
            expect(exception.statusCode).toBe(400)
            expect(exception.isDomainException).toBe(true)
            expect(exception.message).toBe(message)
            expect(exception.name).toBe("ValidationException")
        })

        it("errorCode와 metadata를 전달할 수 있어야 한다", () => {
            // Given
            const message = "필드 검증 실패"
            const errorCode = "FIELD_INVALID"
            const metadata = { field: "email" }

            // When
            const exception = new ValidationException(message, errorCode, metadata)

            // Then
            expect(exception.errorCode).toBe(errorCode)
            expect(exception.metadata).toEqual(metadata)
        })

        it("errorCode와 metadata를 생략하면 undefined여야 한다", () => {
            // Given & When
            const exception = new ValidationException("메시지")

            // Then
            expect(exception.errorCode).toBeUndefined()
            expect(exception.metadata).toBeUndefined()
        })

        it("Error를 상속하므로 instanceof Error가 true여야 한다", () => {
            // Given & When
            const exception = new ValidationException("테스트")

            // Then
            expect(exception).toBeInstanceOf(Error)
            expect(exception).toBeInstanceOf(DomainException)
            expect(exception).toBeInstanceOf(ValidationException)
        })
    })

    describe("NotFoundException.forResource (정적 팩토리)", () => {
        it("리소스 타입 + 식별자로 NotFoundException을 생성해야 한다", () => {
            // Given & When
            const exception = NotFoundException.forResource("User", "user-123")

            // Then
            expect(exception.statusCode).toBe(404)
            expect(exception.message).toBe("User with identifier user-123 was not found.")
            expect(exception).toBeInstanceOf(NotFoundException)
            expect(exception).toBeInstanceOf(DomainException)
        })
    })

    describe("ConflictException", () => {
        it("statusCode 409와 isDomainException=true를 가져야 한다", () => {
            // Given
            const message = "이미 존재하는 리소스입니다"

            // When
            const exception = new ConflictException(message)

            // Then
            expect(exception.statusCode).toBe(409)
            expect(exception.isDomainException).toBe(true)
            expect(exception.message).toBe(message)
            expect(exception.name).toBe("ConflictException")
        })

        it("errorCode와 metadata를 전달할 수 있어야 한다", () => {
            // Given
            const metadata = { existingId: "abc" }

            // When
            const exception = new ConflictException("충돌", "DUPLICATE", metadata)

            // Then
            expect(exception.errorCode).toBe("DUPLICATE")
            expect(exception.metadata).toEqual(metadata)
        })
    })

    describe("UnauthorizedException", () => {
        it("statusCode 401이고 기본 메시지가 'Unauthorized access'여야 한다", () => {
            // Given & When
            const exception = new UnauthorizedException()

            // Then
            expect(exception.statusCode).toBe(401)
            expect(exception.message).toBe("Unauthorized access")
            expect(exception.isDomainException).toBe(true)
            expect(exception.name).toBe("UnauthorizedException")
        })

        it("커스텀 메시지를 전달하면 기본 메시지를 덮어써야 한다", () => {
            // Given
            const customMessage = "토큰이 만료되었습니다"

            // When
            const exception = new UnauthorizedException(customMessage)

            // Then
            expect(exception.message).toBe(customMessage)
        })
    })

    describe("NotFoundException", () => {
        it("statusCode 404이고 기본 메시지가 'Resource not found'여야 한다", () => {
            // Given & When
            const exception = new NotFoundException()

            // Then
            expect(exception.statusCode).toBe(404)
            expect(exception.message).toBe("Resource not found")
            expect(exception.isDomainException).toBe(true)
            expect(exception.name).toBe("NotFoundException")
        })

        it("커스텀 메시지를 전달할 수 있어야 한다", () => {
            // Given & When
            const exception = new NotFoundException("스크립트를 찾을 수 없습니다")

            // Then
            expect(exception.message).toBe("스크립트를 찾을 수 없습니다")
        })
    })

    describe("ForbiddenException", () => {
        it("statusCode 403이고 기본 메시지가 'Access denied'여야 한다", () => {
            // Given & When
            const exception = new ForbiddenException()

            // Then
            expect(exception.statusCode).toBe(403)
            expect(exception.message).toBe("Access denied")
            expect(exception.isDomainException).toBe(true)
            expect(exception.name).toBe("ForbiddenException")
        })

        it("커스텀 메시지와 errorCode를 전달할 수 있어야 한다", () => {
            // Given & When
            const exception = new ForbiddenException("관리자 권한이 필요합니다", "ADMIN_REQUIRED")

            // Then
            expect(exception.message).toBe("관리자 권한이 필요합니다")
            expect(exception.errorCode).toBe("ADMIN_REQUIRED")
        })
    })

    describe("EmailNotVerifiedException", () => {
        describe("이메일 마스킹", () => {
            it("일반 이메일을 마스킹해야 한다: 첫 글자 + 별표(최대3) + 도메인", () => {
                // Given
                const email = "test@example.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "test" -> 첫 글자 "t", middle "es" (2글자) -> min(2, 3) = 2개 별표
                // 결과: "t**@example.com"
                expect(exception.metadata!.email).toBe("t***@example.com")
            })

            it("로컬 파트가 긴 이메일은 별표를 최대 3개로 제한해야 한다", () => {
                // Given
                const email = "longusername@example.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "longusername" -> 첫 글자 "l", middle "ongusername" (11글자) -> min(11, 3) = 3개 별표
                expect(exception.metadata!.email).toBe("l***@example.com")
            })

            it("로컬 파트가 2글자인 이메일은 별표 1개를 사용해야 한다", () => {
                // Given
                const email = "ab@example.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "ab" -> 첫 글자 "a", middle "b" (1글자) -> min(1, 3) = 1개 별표
                expect(exception.metadata!.email).toBe("a*@example.com")
            })

            it("로컬 파트가 1글자인 이메일은 별표 0개를 사용해야 한다", () => {
                // Given
                const email = "a@example.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "a" -> 첫 글자 "a", middle "" (0글자) -> min(0, 3) = 0개 별표
                expect(exception.metadata!.email).toBe("a@example.com")
            })

            it("로컬 파트가 3글자인 이메일은 별표 2개를 사용해야 한다", () => {
                // Given
                const email = "abc@domain.org"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "abc" -> 첫 글자 "a", middle "bc" (2글자) -> min(2, 3) = 2개 별표
                expect(exception.metadata!.email).toBe("a**@domain.org")
            })

            it("로컬 파트가 4글자인 이메일은 별표 3개를 사용해야 한다", () => {
                // Given
                const email = "abcd@domain.org"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "abcd" -> 첫 글자 "a", middle "bcd" (3글자) -> min(3, 3) = 3개 별표
                expect(exception.metadata!.email).toBe("a***@domain.org")
            })

            it("서브도메인이 있는 이메일 도메인을 보존해야 한다", () => {
                // Given
                const email = "user@mail.example.co.kr"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                expect(exception.metadata!.email).toBe("u***@mail.example.co.kr")
            })

            it("숫자로 시작하는 이메일을 올바르게 마스킹해야 한다", () => {
                // Given
                const email = "123user@gmail.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                // "123user" -> 첫 글자 "1", middle "23use" (5글자) -> min(5, 3) = 3개 별표
                expect(exception.metadata!.email).toBe("1***@gmail.com")
            })

            it("특수문자가 포함된 로컬 파트를 올바르게 마스킹해야 한다", () => {
                // Given
                const email = "user.name+tag@example.com"

                // When
                const exception = new EmailNotVerifiedException(email)

                // Then
                expect(exception.metadata!.email).toBe("u***@example.com")
            })
        })

        describe("예외 속성", () => {
            it("errorCode가 'EMAIL_NOT_VERIFIED'여야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                expect(exception.errorCode).toBe("EMAIL_NOT_VERIFIED")
            })

            it("message가 'auth.email_not_verified'여야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                expect(exception.message).toBe("auth.email_not_verified")
            })

            it("ForbiddenException을 상속하므로 statusCode 403이어야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                expect(exception.statusCode).toBe(403)
                expect(exception).toBeInstanceOf(ForbiddenException)
                expect(exception).toBeInstanceOf(DomainException)
            })

            it("name이 'EmailNotVerifiedException'이어야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                expect(exception.name).toBe("EmailNotVerifiedException")
            })
        })

        describe("canResendCode 파라미터", () => {
            it("기본값이 true여야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                expect(exception.metadata!.canResendCode).toBe(true)
            })

            it("false를 전달하면 false여야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com", false)

                // Then
                expect(exception.metadata!.canResendCode).toBe(false)
            })
        })

        describe("resendAvailableAt 계산", () => {
            it("기본 쿨다운(60초) 기준으로 미래 시각을 계산해야 한다", () => {
                // Given
                const before = Date.now()

                // When
                const exception = new EmailNotVerifiedException("test@example.com")
                const after = Date.now()

                // Then
                const resendAt = new Date(exception.metadata!.resendAvailableAt).getTime()
                expect(resendAt).toBeGreaterThanOrEqual(before + 60_000)
                expect(resendAt).toBeLessThanOrEqual(after + 60_000)
            })

            it("커스텀 쿨다운을 전달하면 해당 초 기준으로 계산해야 한다", () => {
                // Given
                const cooldownSeconds = 120
                const before = Date.now()

                // When
                const exception = new EmailNotVerifiedException(
                    "test@example.com",
                    true,
                    cooldownSeconds
                )
                const after = Date.now()

                // Then
                const resendAt = new Date(exception.metadata!.resendAvailableAt).getTime()
                expect(resendAt).toBeGreaterThanOrEqual(before + 120_000)
                expect(resendAt).toBeLessThanOrEqual(after + 120_000)
            })

            it("resendAvailableAt은 ISO 8601 형식이어야 한다", () => {
                // Given & When
                const exception = new EmailNotVerifiedException("test@example.com")

                // Then
                const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
                expect(exception.metadata!.resendAvailableAt).toMatch(isoRegex)
            })
        })
    })

    describe("AccountSuspendedException", () => {
        it("errorCode가 'ACCOUNT_SUSPENDED'여야 한다", () => {
            // Given & When
            const exception = new AccountSuspendedException("정책 위반")

            // Then
            expect(exception.errorCode).toBe("ACCOUNT_SUSPENDED")
        })

        it("message가 'auth.account_suspended'여야 한다", () => {
            // Given & When
            const exception = new AccountSuspendedException()

            // Then
            expect(exception.message).toBe("auth.account_suspended")
        })

        it("metadata.reason에 정지 사유가 포함되어야 한다", () => {
            // Given
            const reason = "부적절한 콘텐츠 게시"

            // When
            const exception = new AccountSuspendedException(reason)

            // Then
            expect(exception.metadata!.reason).toBe(reason)
        })

        it("reason을 생략하면 metadata.reason이 undefined여야 한다", () => {
            // Given & When
            const exception = new AccountSuspendedException()

            // Then
            expect(exception.metadata!.reason).toBeUndefined()
        })

        it("ForbiddenException을 상속하므로 statusCode 403이어야 한다", () => {
            // Given & When
            const exception = new AccountSuspendedException()

            // Then
            expect(exception.statusCode).toBe(403)
            expect(exception).toBeInstanceOf(ForbiddenException)
        })
    })

    describe("AccountLockedException", () => {
        it("errorCode가 'ACCOUNT_LOCKED'여야 한다", () => {
            // Given & When
            const exception = new AccountLockedException()

            // Then
            expect(exception.errorCode).toBe("ACCOUNT_LOCKED")
        })

        it("message가 'auth.account_locked'여야 한다", () => {
            // Given & When
            const exception = new AccountLockedException()

            // Then
            expect(exception.message).toBe("auth.account_locked")
        })

        it("metadata.unlockAt에 잠금 해제 시각이 ISO 형식으로 포함되어야 한다", () => {
            // Given
            const unlockAt = new Date("2026-03-01T00:00:00.000Z")

            // When
            const exception = new AccountLockedException(unlockAt)

            // Then
            expect(exception.metadata!.unlockAt).toBe("2026-03-01T00:00:00.000Z")
        })

        it("unlockAt을 생략하면 metadata.unlockAt이 undefined여야 한다", () => {
            // Given & When
            const exception = new AccountLockedException()

            // Then
            expect(exception.metadata!.unlockAt).toBeUndefined()
        })

        it("ForbiddenException을 상속하므로 statusCode 403이어야 한다", () => {
            // Given & When
            const exception = new AccountLockedException()

            // Then
            expect(exception.statusCode).toBe(403)
            expect(exception).toBeInstanceOf(ForbiddenException)
        })
    })
})

describe("ServiceUnavailableException (단위 테스트)", () => {
    it("isInfrastructureException=true를 가져야 한다", () => {
        // Given & When
        const exception = new ServiceUnavailableException("Redis")

        // Then
        expect(exception.isInfrastructureException).toBe(true)
    })

    it("name이 'ServiceUnavailableException'이어야 한다", () => {
        // Given & When
        const exception = new ServiceUnavailableException("Redis")

        // Then
        expect(exception.name).toBe("ServiceUnavailableException")
    })

    it("메시지 형식이 '${service} is currently unavailable'이어야 한다", () => {
        // Given
        const service = "Redis"

        // When
        const exception = new ServiceUnavailableException(service)

        // Then
        expect(exception.message).toBe("Redis is currently unavailable")
    })

    it("serviceName 속성에 서비스명이 저장되어야 한다", () => {
        // Given
        const service = "PostgreSQL"

        // When
        const exception = new ServiceUnavailableException(service)

        // Then
        expect(exception.serviceName).toBe("PostgreSQL")
    })

    it("Error를 상속하지만 DomainException은 아니어야 한다", () => {
        // Given & When
        const exception = new ServiceUnavailableException("Redis")

        // Then
        expect(exception).toBeInstanceOf(Error)
        expect(exception).not.toBeInstanceOf(DomainException)
        expect("isDomainException" in exception).toBe(false)
    })
})
