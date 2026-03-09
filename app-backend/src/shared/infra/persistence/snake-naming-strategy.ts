import { DefaultNamingStrategy, NamingStrategyInterface } from "typeorm"

function toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
}

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
        const name = customName || toSnakeCase(propertyName)
        return embeddedPrefixes.length ? embeddedPrefixes.join("_") + name : name
    }

    relationName(propertyName: string): string {
        return toSnakeCase(propertyName)
    }

    joinColumnName(relationName: string, referencedColumnName: string): string {
        return toSnakeCase(relationName) + "_" + referencedColumnName
    }

    joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
        return tableName + "_" + (columnName || toSnakeCase(propertyName))
    }
}
