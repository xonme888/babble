import he from "he"

/**
 * HTML 엔티티 이스케이프 — XSS 방지
 * 사용자 입력이 HTML 컨텍스트에 삽입될 때 스크립트 주입을 방지한다.
 * he.escape()는 &, <, >, ", ' 5개 문자를 named 엔티티로 변환한다.
 */
export function escapeHtml(text: string): string {
    return he.escape(text)
}
