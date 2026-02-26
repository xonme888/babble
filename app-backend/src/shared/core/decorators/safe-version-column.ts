import { VersionColumn } from "typeorm"
import type { ColumnOptions } from "typeorm"

/**
 * @VersionColumn 래퍼 — default: 1 내장
 *
 * 기존 행이 있는 테이블에 synchronize로 version 컬럼을 추가할 때
 * NOT NULL + DEFAULT 없이 ALTER TABLE이 실패하는 문제를 방지한다.
 *
 * @VersionColumn() 직접 사용 금지 — 반드시 이 데코레이터를 사용할 것
 */
export function SafeVersionColumn(options?: ColumnOptions): PropertyDecorator {
    return VersionColumn({ default: 1, ...options })
}
