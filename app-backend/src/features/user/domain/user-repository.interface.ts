import type { User } from "./user.entity"

/**
 * IUserRepository — cross-feature 소비자용 Port
 *
 * UserRepository의 메서드 중 다른 피처에서 사용하는 것만 노출한다.
 */
export interface IUserRepository {
    findById(id: number): Promise<User | null>
    findByIds(ids: number[]): Promise<User[]>
    findByIdOrThrow(id: number, message?: string): Promise<User>
    findByEmail(email: string): Promise<User | null>
    findByEmailWithPassword(email: string): Promise<User | null>
    existsByEmail(email: string): Promise<boolean>
    save(user: User): Promise<User>
    findGuestByDeviceId(deviceId: string): Promise<User | null>
    findUpgradedUserByDeviceId(deviceId: string): Promise<User | null>
    softDelete(id: number): Promise<void>
    mergeGuestData(guestUserId: number, targetUserId: number): Promise<void>
}
