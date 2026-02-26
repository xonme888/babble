import { escapeHtml } from "@shared/utils/sanitize.utils"

describe("escapeHtml (HTML 엔티티 이스케이프)", () => {
    it("기본 5개 HTML 특수문자를 이스케이프한다", () => {
        expect(escapeHtml("&")).toBe("&amp;")
        expect(escapeHtml("<")).toBe("&lt;")
        expect(escapeHtml(">")).toBe("&gt;")
        expect(escapeHtml('"')).toBe("&quot;")
        expect(escapeHtml("'")).toBe("&#x27;")
    })

    it("일반 텍스트는 변경 없이 반환한다", () => {
        expect(escapeHtml("Hello World")).toBe("Hello World")
        expect(escapeHtml("안녕하세요")).toBe("안녕하세요")
    })

    it("빈 문자열은 빈 문자열을 반환한다", () => {
        expect(escapeHtml("")).toBe("")
    })

    it("복합 HTML 주입 공격을 방어한다", () => {
        const malicious = '<script>alert("XSS")</script>'
        const result = escapeHtml(malicious)

        expect(result).not.toContain("<script>")
        expect(result).not.toContain("</script>")
        expect(result).toContain("&lt;script&gt;")
    })

    it("HTML 속성 주입을 방어한다", () => {
        const input = '" onload="alert(1)'
        const result = escapeHtml(input)

        expect(result).not.toContain('"')
        expect(result).toContain("&quot;")
    })
})
