import type { User, UserRole } from "@features/user/domain/user.entity"

/**
 * 회원가입 응답 DTO — password 등 민감 필드 제외
 *
 * @openapi
 * components:
 *   schemas:
 *     RegisterResponseDto:
 *       type: object
 *       required: [id, email, firstName]
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 */
export class RegisterResponseDto {
    id!: number
    email!: string
    firstName!: string

    static from(entity: User): RegisterResponseDto {
        const dto = new RegisterResponseDto()
        dto.id = entity.id
        dto.email = entity.email
        dto.firstName = entity.firstName
        return dto
    }
}

/**
 * 로그인 사용자 정보 DTO — 토큰 응답의 user 필드용
 *
 * @openapi
 * components:
 *   schemas:
 *     LoginUserDto:
 *       type: object
 *       required: [id, email, firstName, role]
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [GUEST, USER, ADMIN]
 */
export class LoginUserDto {
    id!: number
    email!: string
    firstName!: string
    role!: UserRole

    static from(entity: User): LoginUserDto {
        const dto = new LoginUserDto()
        dto.id = entity.id
        dto.email = entity.email
        dto.firstName = entity.firstName
        dto.role = entity.role
        return dto
    }
}
