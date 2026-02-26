import "reflect-metadata"
import { UserGoalLog } from "@features/user/domain/user-goal-log.entity"

export {}

describe("UserGoalLog (주간 목표 변경 이력)", () => {
    describe("create (팩토리 메서드)", () => {
        it("주간 목표 변경 로그를 생성한다", () => {
            // When
            const log = UserGoalLog.create({
                userId: 1,
                previousGoal: 3,
                newGoal: 5,
            })

            // Then
            expect(log).toBeInstanceOf(UserGoalLog)
            expect(log.userId).toBe(1)
            expect(log.previousGoal).toBe(3)
            expect(log.newGoal).toBe(5)
        })

        it("0에서 목표를 설정하는 경우도 생성할 수 있다", () => {
            // When
            const log = UserGoalLog.create({
                userId: 2,
                previousGoal: 0,
                newGoal: 7,
            })

            // Then
            expect(log.previousGoal).toBe(0)
            expect(log.newGoal).toBe(7)
        })
    })
})
