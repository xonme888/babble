import { Request, Response, NextFunction } from "express"
import { plainToInstance } from "class-transformer"
import { validate, ValidationError } from "class-validator"
import { ValidationException } from "@shared/core/exceptions/domain-exceptions"
import { container } from "tsyringe"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

/** DTO 클래스 생성자 타입 */
type Constructor<T = object> = new (...args: unknown[]) => T

/**
 * DTO 기반 유효성 검사 미들웨어
 * @param type 검증할 DTO 클래스 타입
 */
export function validateDto(type: Constructor) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)

        if (!type) {
            logger.error("[ValidationMiddleware] DTO type is undefined")
            return next(new ValidationException("Internal Server Error: DTO validation type missing"))
        }

        if (!req.body) {
            logger.warn("[ValidationMiddleware] req.body is missing")
            req.body = {}
        }

        const dtoInstance = plainToInstance(type, req.body)
        const errors: ValidationError[] = await validate(dtoInstance, {
            whitelist: true,
            forbidNonWhitelisted: true,
        })

        if (errors.length > 0) {
            const message = errors
                .map((error: ValidationError) => Object.values(error.constraints || {}))
                .flat()
                .join(", ")

            return next(new ValidationException(message))
        }

        // 검증된 객체를 body에 다시 할당 (타입 안정성 확보)
        req.body = dtoInstance
        next()
    }
}
