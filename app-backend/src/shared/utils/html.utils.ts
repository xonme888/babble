/** 이메일 text 대체본 생성용 */
export function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>?/gm, "")
}
