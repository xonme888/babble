import * as bcrypt from "bcryptjs"
import { injectable, inject } from "tsyringe"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import type { IConfigService } from "@shared/core/config.interface"

/**
 * Bcrypt 기반 패스워드 해시 구현체 (Auth Domain Infrastructure)
 */
@injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
    private readonly rounds: number

    constructor(@inject(DI_TOKENS.IConfigService) configService: IConfigService) {
        this.rounds = configService.config.bcrypt.rounds
    }

    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.rounds)
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash)
    }
}
