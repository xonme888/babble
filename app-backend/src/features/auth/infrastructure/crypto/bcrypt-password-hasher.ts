import * as bcrypt from "bcryptjs"
import { injectable, inject } from "tsyringe"
import { IPasswordHasher } from "@shared/core/password-hasher.interface"
import { ConfigService } from "@shared/infra/config/config.service"

/**
 * Bcrypt 기반 패스워드 해시 구현체 (Auth Domain Infrastructure)
 */
@injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
    private readonly rounds: number

    constructor(@inject(ConfigService) configService: ConfigService) {
        this.rounds = configService.config.bcrypt.rounds
    }

    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.rounds)
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash)
    }
}
