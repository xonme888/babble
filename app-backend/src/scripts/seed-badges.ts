import "reflect-metadata"
import { config } from "dotenv"
config()

import { initializeTransactionalContext } from "typeorm-transactional"
initializeTransactionalContext()

import { AppDataSource } from "@shared/infra/persistence/data-source"
import { Badge } from "@features/gamification/domain/badge.entity"
import { BADGE_SEEDS } from "@features/gamification/infrastructure/seed/badge-seed"

/**
 * 뱃지 시드 스크립트
 * code 기준 upsert — FK 안전 (TRUNCATE 대신)
 */
async function seed(): Promise<void> {
    try {
        await AppDataSource.initialize()
        console.log("Data Source has been initialized!")

        const badgeRepo = AppDataSource.getRepository(Badge)

        let created = 0
        let updated = 0

        for (const seedData of BADGE_SEEDS) {
            const existing = await badgeRepo.findOneBy({ code: seedData.code })
            if (existing) {
                await badgeRepo.update(existing.id, seedData)
                updated++
            } else {
                await badgeRepo.save(badgeRepo.create(seedData))
                created++
            }
        }

        console.log(
            `\nSeeding complete: ${created}개 생성, ${updated}개 업데이트 (총 ${BADGE_SEEDS.length}개)`
        )
        process.exit(0)
    } catch (err) {
        console.error("Error during seeding:", err)
        process.exit(1)
    }
}

seed()
