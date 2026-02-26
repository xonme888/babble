import { injectable, inject } from "tsyringe"
import { ILoginStrategy } from "./login-strategy.interface"
import { User } from "@features/user/domain/user.entity"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { UnauthorizedException } from "@shared/core/exceptions/domain-exceptions"

/**
 * 이메일/비밀번호 기반 로그인 전략
 *
 * Strategy Pattern 구현
 * - 이메일과 비밀번호로 사용자 인증
 * - 비밀번호 검증 (Password VO 사용)
 * - 이메일 인증 및 계정 활성화 상태 확인
 */
@injectable()
export class EmailLoginStrategy implements ILoginStrategy {
    constructor(
        @inject(DI_TOKENS.IUserRepository) private userRepository: IUserRepository,
        @inject(DI_TOKENS.IPasswordHasher) private passwordHasher: IPasswordHasher
    ) {}

    getName(): string {
        return "email"
    }

    async login(credentials: { email: string; password: string }): Promise<User> {
        const { email, password } = credentials

        // 사용자 조회 (비밀번호 포함)
        const user = await this.userRepository.findByEmailWithPassword(email)
        if (!user) {
            throw new UnauthorizedException("auth.invalid_credentials", "INVALID_CREDENTIALS")
        }

        // 비밀번호 검증 (User Entity + IPasswordHasher 사용)
        const isValid = await user.validatePassword(password, this.passwordHasher)
        if (!isValid) {
            throw new UnauthorizedException("auth.invalid_credentials", "INVALID_CREDENTIALS")
        }

        // 로그인 전제조건 검증 (이메일 인증 + 계정 활성 상태)
        user.ensureLoginEligible()

        return user
    }
}
