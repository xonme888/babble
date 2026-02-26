import "reflect-metadata"
import { config } from "dotenv"
config()

import { initializeTransactionalContext } from "typeorm-transactional"
initializeTransactionalContext()

import { AppDataSource } from "@shared/infra/persistence/data-source"
import { GameConfig } from "@features/gamification/domain/game-config.entity"
import { GAME_CONFIG_SEEDS } from "@features/gamification/infrastructure/seed/game-config-seed"

/**
 * GameConfig 시드 스크립트
 * key 기준 upsert — 기존 값은 업데이트, 새 값은 생성
 */
async function seed(): Promise<void> {
    try {
        await AppDataSource.initialize()
        console.log("Data Source has been initialized!")

        const configRepo = AppDataSource.getRepository(GameConfig)

        let created = 0
        let updated = 0

        for (const seedData of GAME_CONFIG_SEEDS) {
            const existing = await configRepo.findOneBy({ key: seedData.key })
            if (existing) {
                await configRepo.update(existing.id, {
                    value: seedData.value,
                    category: seedData.category,
                    description: seedData.description,
                })
                updated++
            } else {
                const config = configRepo.create(seedData)
                await configRepo.save(config)
                created++
            }
        }

        console.log(
            `\nSeeding complete: ${created}개 생성, ${updated}개 업데이트 (총 ${GAME_CONFIG_SEEDS.length}개)`
        )
        process.exit(0)
    } catch (err) {
        console.error("Error during seeding:", err)
        process.exit(1)
    }
}

seed()
