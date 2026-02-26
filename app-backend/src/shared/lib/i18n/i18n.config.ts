import i18next from "i18next"
import Backend from "i18next-fs-backend"
import middleware from "i18next-http-middleware"
import path from "path"

/**
 * i18n Configuration
 *
 * 다국어 지원 설정 (영어, 한국어)
 * - Backend: 파일 시스템 기반 번역 파일 로드
 * - Detection: Header, Query, Cookie 기반 언어 감지
 */
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        fallbackLng: "en",
        backend: {
            loadPath: path.join(__dirname, "./locales/{{lng}}/{{ns}}.json"),
        },
        ns: ["common"],
        defaultNS: "common",
        preload: ["en", "ko"],
        detection: {
            order: ["header", "querystring", "cookie"],
            caches: ["cookie"],
        },
    })

export default i18next
export const i18nMiddleware = middleware.handle(i18next)
