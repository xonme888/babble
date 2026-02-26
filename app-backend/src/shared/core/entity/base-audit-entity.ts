import { UpdateDateColumn } from "typeorm"
import { BaseCreatedEntity } from "./base-created-entity"

/** 수정 추적이 필요한 엔티티용 */
export abstract class BaseAuditEntity extends BaseCreatedEntity {
    @UpdateDateColumn()
    updatedAt: Date
}
