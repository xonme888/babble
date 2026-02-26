import { injectable } from "tsyringe"
import { NotFoundException } from "@shared/core/exceptions/domain-exceptions"
import { ILoginStrategy } from "./login-strategy.interface"

/**
 * 로그인 전략 팩토리 (Factory Pattern)
 *
 * 전략 타입에 따라 적절한 로그인 전략 반환
 * 새로운 로그인 방식 추가 시 이 팩토리만 수정 (OCP)
 */
@injectable()
export class LoginStrategyFactory {
    private strategies: Map<string, ILoginStrategy>

    constructor() {
        this.strategies = new Map()
    }

    /**
     * 전략 등록
     */
    registerStrategy(strategy: ILoginStrategy): void {
        this.strategies.set(strategy.getName(), strategy)
    }

    /**
     * 전략 이름으로 전략 가져오기
     */
    getStrategy(name: string): ILoginStrategy {
        const strategy = this.strategies.get(name)
        if (!strategy) {
            throw new NotFoundException(
                "auth.strategy_not_found",
                "STRATEGY_NOT_FOUND",
                { strategyName: name }
            )
        }
        return strategy
    }

    /**
     * 등록된 모든 전략 이름 조회
     */
    getAvailableStrategies(): string[] {
        return Array.from(this.strategies.keys())
    }
}
