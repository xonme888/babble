import tseslint from "typescript-eslint"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
    // 전역 무시 패턴
    {
        ignores: ["node_modules/", "build/", "dist/", "coverage/", "uploads/", "*.js", "*.mjs"],
    },

    // TypeScript 기본 규칙
    ...tseslint.configs.recommended,

    // Prettier 충돌 방지 (반드시 마지막)
    eslintConfigPrettier,

    // src/ 프로덕션 코드 — 엄격한 규칙
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // 사용하지 않는 변수 경고 (_ 접두사는 허용)
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // any 사용 금지 — Mock Factory 또는 타입 정의로 대체
            "@typescript-eslint/no-explicit-any": "error",

            // 빈 함수 허용 (DI constructor 등)
            "@typescript-eslint/no-empty-function": "off",

            // require 허용 (기존 코드 호환)
            "@typescript-eslint/no-require-imports": "off",

            // 느낌표 단언 금지 — extractUserId(req) 등 헬퍼 사용
            "@typescript-eslint/no-non-null-assertion": "error",
        },
    },

    // src/**/application/ — DDD 아키텍처 경계 강제
    {
        files: ["src/features/*/application/**/*.ts"],
        rules: {
            "no-restricted-imports": ["error", {
                patterns: [
                    {
                        group: ["**/shared/infra/*", "**/shared/infra/**"],
                        message: "Application 레이어는 shared/infra를 직접 import할 수 없습니다. shared/core의 Port 인터페이스 + DI를 사용하세요.",
                    },
                    {
                        group: ["**/presentation/*", "**/presentation/**"],
                        message: "Application 레이어는 Presentation을 import할 수 없습니다.",
                    },
                ],
            }],
        },
    },

    // src/**/domain/ — 가장 엄격한 규칙 (안쪽 레이어)
    {
        files: ["src/features/*/domain/**/*.ts", "src/shared/core/**/*.ts"],
        rules: {
            "no-restricted-imports": ["error", {
                patterns: [
                    {
                        group: ["**/application/*", "**/application/**"],
                        message: "Domain 레이어는 Application을 import할 수 없습니다.",
                    },
                    {
                        group: ["**/infrastructure/*", "**/infrastructure/**"],
                        message: "Domain 레이어는 Infrastructure를 import할 수 없습니다.",
                    },
                    {
                        group: ["**/presentation/*", "**/presentation/**"],
                        message: "Domain 레이어는 Presentation을 import할 수 없습니다.",
                    },
                    {
                        group: ["**/shared/infra/*", "**/shared/infra/**"],
                        message: "Domain 레이어는 shared/infra를 import할 수 없습니다.",
                    },
                ],
            }],
        },
    },

    // test/ 테스트 코드 — 완화된 규칙
    {
        files: ["test/**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // 사용하지 않는 변수 경고 (_ 접두사는 허용)
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // any 사용 경고 (Mock Factory 허용, 점진 개선)
            "@typescript-eslint/no-explicit-any": "warn",

            // 빈 함수 허용 (DI constructor 등)
            "@typescript-eslint/no-empty-function": "off",

            // require 허용 (기존 코드 호환)
            "@typescript-eslint/no-require-imports": "off",

            // 느낌표 단언 경고 (테스트 Mock 허용, 점진 개선)
            "@typescript-eslint/no-non-null-assertion": "warn",
        },
    }
)
