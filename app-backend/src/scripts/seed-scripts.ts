import "reflect-metadata"
import { config } from "dotenv"
config() // .env 로드 (ts-node 직접 실행 시 필요)

import { initializeTransactionalContext } from "typeorm-transactional"
initializeTransactionalContext() // DataSource.initialize() 전에 반드시 호출

import * as fs from "fs"
import * as path from "path"
import { AppDataSource } from "@shared/infra/persistence/data-source"
import {
    Script,
    ScriptDifficulty,
    ArticulationPlace,
} from "../features/script/domain/script.entity"
import { Chapter } from "../features/script/domain/chapter.entity"

/** 잠언 JSON 스키마 */
interface ProverbsData {
    book: string
    translation: string
    chapters: {
        chapter: number
        title: string
        description: string
        verses: { verse: number; text: string }[]
    }[]
}

/** 텍스트 길이 기반 난이도 자동 분류 */
function getDifficulty(text: string): ScriptDifficulty {
    const len = text.length
    if (len <= 40) return ScriptDifficulty.EASY
    if (len <= 80) return ScriptDifficulty.MEDIUM
    return ScriptDifficulty.HARD
}

async function seed(): Promise<void> {
    try {
        await AppDataSource.initialize()
        console.log("Data Source has been initialized!")

        const scriptRepo = AppDataSource.getRepository(Script)
        const chapterRepo = AppDataSource.getRepository(Chapter)

        // 1. 기존 데이터 삭제 (TRUNCATE CASCADE — FK 의존성 자동 처리)
        await AppDataSource.query(`TRUNCATE TABLE scripts, chapters RESTART IDENTITY CASCADE`)
        console.log("Truncated scripts & chapters")

        // 2. JSON 로드
        const jsonPath = path.join(__dirname, "data", "proverbs.json")
        const raw = fs.readFileSync(jsonPath, "utf-8")
        const proverbs: ProverbsData = JSON.parse(raw)

        console.log(
            `Loaded ${proverbs.book} (${proverbs.translation}) — ${proverbs.chapters.length}장`
        )

        let totalScripts = 0

        // 3. 챕터 + 절별 구절 생성
        for (const ch of proverbs.chapters) {
            const chapter = chapterRepo.create({
                title: ch.title,
                description: ch.description,
                orderIndex: ch.chapter,
            })
            await chapterRepo.save(chapter)
            console.log(`Created chapter: ${ch.title} (${ch.verses.length}절)`)

            // 4. 절별 구절 생성
            for (const v of ch.verses) {
                const script = scriptRepo.create({
                    title: `잠언 ${ch.chapter}장 ${v.verse}절`,
                    content: v.text,
                    category: "bible",
                    difficulty: getDifficulty(v.text),
                    articulationPlace: ArticulationPlace.MIXED,
                    chapterId: chapter.id,
                    orderIndex: v.verse,
                })
                await scriptRepo.save(script)
            }

            totalScripts += ch.verses.length
        }

        console.log(`\nSeeding complete: ${proverbs.chapters.length}장, ${totalScripts}절`)
        process.exit(0)
    } catch (err) {
        console.error("Error during seeding:", err)
        process.exit(1)
    }
}

seed()
