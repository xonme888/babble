import "reflect-metadata"
import { container } from "tsyringe"
import { NotificationService } from "../features/notification/application/notification.service"
import { AppDataSource } from "../shared/infra/persistence/data-source"

async function main() {
    console.log("Initializing DataSource...")
    await AppDataSource.initialize()

    console.log("Enqueuing test email job via NotificationService...")

    const notificationService = container.resolve(NotificationService)

    try {
        await notificationService.send(
            process.env.TEST_EMAIL_RECIPIENT ?? "test@example.com",
            "Test Email [LOGGED]",
            "<h1>It works!</h1><p>This email was logged and sent via BullMQ worker.</p>"
        )
        console.log("Job enqueued successfully. Check database logs.")
    } catch (error) {
        console.error("Failed to enqueue job:", error)
    }

    // Wait a bit to ensure async operations complete if any
    setTimeout(() => {
        process.exit(0)
    }, 1000)
}

main().catch(console.error)
