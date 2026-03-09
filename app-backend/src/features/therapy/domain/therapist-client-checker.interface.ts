export interface ITherapistClientChecker {
    isLinked(therapistId: number, clientId: number): Promise<boolean>
}
