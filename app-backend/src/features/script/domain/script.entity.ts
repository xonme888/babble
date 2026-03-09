export class Script {
    id: number
    content: string
    static sanitize(text: string): string { return text.replace(/<[^>]*>/g, "").trim() }
}
