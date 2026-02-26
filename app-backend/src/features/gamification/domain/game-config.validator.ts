/**
 * GameConfig 값 유효성 검증
 * PRD-006 섹션 2.1의 규칙 테이블 구현
 */

interface ValidationRule {
    type:
        | "int"
        | "float"
        | "boolean"
        | "int_array"
        | "float_array"
        | "string_array"
        | "blanks_range"
    min?: number
    max?: number
    arrayMin?: number
    arrayMax?: number
    elementMin?: number
    elementMax?: number
}

export interface ValidationResult {
    valid: boolean
    message?: string
}

/**
 * key 패턴 매칭 기반 유효성 검증 규칙
 * 구체적인 패턴이 우선 매칭된다 (longest match first)
 */
const VALIDATION_RULES: Array<{ pattern: RegExp; rule: ValidationRule }> = [
    // boolean 패턴 (*.enabled)
    { pattern: /\.enabled$/, rule: { type: "boolean" } },

    // 콤보 배율 배열
    {
        pattern: /^xp\.combo\.multipliers$/,
        rule: { type: "float_array", arrayMin: 2, arrayMax: 10, elementMin: 1.0, elementMax: 5.0 },
    },

    // 배율 (*.multiplier)
    { pattern: /\.multiplier$/, rule: { type: "float", min: 1.0, max: 5.0 } },

    // 비율 (todayFirstRatio)
    { pattern: /^game\.todayFirstRatio$/, rule: { type: "float", min: 0.0, max: 1.0 } },

    // 빈칸 범위 ({min, max})
    { pattern: /Blanks$/, rule: { type: "blanks_range", min: 0, max: 15 } },

    // 힌트 타입 배열
    { pattern: /^hint\.types$/, rule: { type: "string_array", arrayMin: 1, arrayMax: 10 } },

    // 힌트 설정 (정수)
    { pattern: /^hint\.maxPerSentence$/, rule: { type: "int", min: 0, max: 10 } },
    { pattern: /^hint\.xpPenalty$/, rule: { type: "int", min: 0, max: 50 } },
    { pattern: /^hint\.autoShowAfterWrong$/, rule: { type: "int", min: 1, max: 10 } },

    // 번들 크기
    { pattern: /^bundle\.size$/, rule: { type: "int", min: 2, max: 20 } },

    // XP 값 (xp.* 기본)
    { pattern: /^xp\./, rule: { type: "int", min: 0, max: 500 } },

    // 게임 점수 임계값
    {
        pattern: /^game\.adaptiveDifficulty\.highScoreThreshold$/,
        rule: { type: "int", min: 0, max: 100 },
    },
]

/**
 * 주어진 key-value 쌍의 유효성을 검증한다.
 */
export function validateGameConfigValue(key: string, value: unknown): ValidationResult {
    const matched = VALIDATION_RULES.find((r) => r.pattern.test(key))
    if (!matched) {
        // 규칙이 없으면 통과 (알 수 없는 key는 자유 입력)
        return { valid: true }
    }

    const { rule } = matched

    switch (rule.type) {
        case "int":
            return validateInt(value, rule.min ?? 0, rule.max ?? 500)
        case "float":
            return validateFloat(value, rule.min ?? 0, rule.max ?? 100)
        case "boolean":
            return validateBoolean(value)
        case "float_array":
            return validateFloatArray(value, rule)
        case "string_array":
            return validateStringArray(value, rule)
        case "blanks_range":
            return validateBlanksRange(value, rule.min ?? 0, rule.max ?? 15)
        default:
            return { valid: true }
    }
}

function validateInt(value: unknown, min: number, max: number): ValidationResult {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return { valid: false, message: `정수여야 합니다` }
    }
    if (value < min || value > max) {
        return { valid: false, message: `${min} ~ ${max} 범위여야 합니다` }
    }
    return { valid: true }
}

function validateFloat(value: unknown, min: number, max: number): ValidationResult {
    if (typeof value !== "number") {
        return { valid: false, message: `숫자여야 합니다` }
    }
    if (value < min || value > max) {
        return { valid: false, message: `${min} ~ ${max} 범위여야 합니다` }
    }
    return { valid: true }
}

function validateBoolean(value: unknown): ValidationResult {
    if (typeof value !== "boolean") {
        return { valid: false, message: `boolean이어야 합니다` }
    }
    return { valid: true }
}

function validateFloatArray(value: unknown, rule: ValidationRule): ValidationResult {
    if (!Array.isArray(value)) {
        return { valid: false, message: `배열이어야 합니다` }
    }
    if (rule.arrayMin !== undefined && value.length < rule.arrayMin) {
        return { valid: false, message: `최소 ${rule.arrayMin}개 요소가 필요합니다` }
    }
    if (rule.arrayMax !== undefined && value.length > rule.arrayMax) {
        return { valid: false, message: `최대 ${rule.arrayMax}개 요소까지 허용됩니다` }
    }
    for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== "number") {
            return { valid: false, message: `요소 [${i}]이 숫자가 아닙니다` }
        }
        if (rule.elementMin !== undefined && value[i] < rule.elementMin) {
            return { valid: false, message: `요소 [${i}]이 ${rule.elementMin} 미만입니다` }
        }
        if (rule.elementMax !== undefined && value[i] > rule.elementMax) {
            return { valid: false, message: `요소 [${i}]이 ${rule.elementMax} 초과입니다` }
        }
    }
    return { valid: true }
}

function validateStringArray(value: unknown, rule: ValidationRule): ValidationResult {
    if (!Array.isArray(value)) {
        return { valid: false, message: `배열이어야 합니다` }
    }
    if (rule.arrayMin !== undefined && value.length < rule.arrayMin) {
        return { valid: false, message: `최소 ${rule.arrayMin}개 요소가 필요합니다` }
    }
    if (rule.arrayMax !== undefined && value.length > rule.arrayMax) {
        return { valid: false, message: `최대 ${rule.arrayMax}개 요소까지 허용됩니다` }
    }
    for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== "string") {
            return { valid: false, message: `요소 [${i}]이 문자열이 아닙니다` }
        }
    }
    return { valid: true }
}

function validateBlanksRange(value: unknown, min: number, max: number): ValidationResult {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { valid: false, message: `{min, max} 객체여야 합니다` }
    }
    const obj = value as Record<string, unknown>
    if (typeof obj.min !== "number" || typeof obj.max !== "number") {
        return { valid: false, message: `min과 max가 숫자여야 합니다` }
    }
    if (!Number.isInteger(obj.min) || !Number.isInteger(obj.max)) {
        return { valid: false, message: `min과 max가 정수여야 합니다` }
    }
    if (obj.min < min || obj.max > max) {
        return { valid: false, message: `${min} ~ ${max} 범위여야 합니다` }
    }
    if (obj.min > obj.max) {
        return { valid: false, message: `min이 max보다 클 수 없습니다` }
    }
    return { valid: true }
}
