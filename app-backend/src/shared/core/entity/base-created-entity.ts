import { PrimaryGeneratedColumn, CreateDateColumn } from "typeorm"

/** updatedAt이 필요 없는 로그성 엔티티용 */
export abstract class BaseCreatedEntity {
    @PrimaryGeneratedColumn()
    id: number

    @CreateDateColumn()
    createdAt: Date
}
