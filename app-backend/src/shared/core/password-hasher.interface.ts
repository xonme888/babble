/**
 * 비밀번호 해싱을 위한 포트 인터페이스 (Shared Core)
 * user, auth 두 feature에서 사용하므로 shared에 위치
 */
export interface IPasswordHasher {
    /**
     * 평문 비밀번호를 해시화
     */
    hash(password: string): Promise<string>

    /**
     * 평문과 해시를 비교하여 일치 여부 확인
     */
    compare(password: string, hash: string): Promise<boolean>
}
