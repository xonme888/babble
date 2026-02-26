/**
 * 이메일 템플릿 함수 모듈
 *
 * 인증/비밀번호 재설정 등 이메일 본문을 중앙 관리한다.
 * AuthService에서 import하여 사용한다.
 */

/** 이메일 템플릿 반환 타입 */
export interface EmailTemplate {
    subject: string
    content: string
}

/** 이메일 인증 코드 템플릿 */
export function verificationEmailTemplate(code: string): EmailTemplate {
    return {
        subject: "이메일 인증 코드",
        content: `인증 코드: ${code}\n\n이 코드는 10분 후 만료됩니다.`,
    }
}

/** 비밀번호 재설정 코드 템플릿 */
export function passwordResetEmailTemplate(code: string): EmailTemplate {
    return {
        subject: "비밀번호 재설정 코드",
        content: `재설정 코드: ${code}\n\n이 코드는 10분 후 만료됩니다.`,
    }
}
