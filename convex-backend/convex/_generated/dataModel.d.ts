import type { GenericId } from "convex/values";
export type Id<TableName extends string = string> = GenericId<TableName>;
export type Doc<TableName extends string = string> = any;
export type DataModel = any;
