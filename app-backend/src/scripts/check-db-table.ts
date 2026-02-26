import "reflect-metadata"
import { AppDataSource } from "../shared/infra/persistence/data-source"
import { NotificationLog } from "../features/notification/domain/notification-log.entity"

async function main() {
    try {
        await AppDataSource.initialize()
        console.log("DataSource initialized.")

        const queryRunner = AppDataSource.createQueryRunner()
        const tableExists = await queryRunner.hasTable("notification_logs")
        console.log(`Table 'notification_logs' exists: ${tableExists}`)

        if (tableExists) {
            const count = await AppDataSource.getRepository(NotificationLog).count()
            console.log(`Row count in 'notification_logs': ${count}`)

            const logs = await AppDataSource.getRepository(NotificationLog).find({
                order: { createdAt: "DESC" },
                take: 5,
            })
            console.log("Recent logs:", JSON.stringify(logs, null, 2))
        }

        await AppDataSource.destroy()
    } catch (error) {
        console.error("Error:", error)
    }
}

main()
