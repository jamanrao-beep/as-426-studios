import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const menu = sqliteTable("menu", { id: text("id").primaryKey(), data: text("data").notNull(), revision: integer("revision").notNull().default(1) });
export const members = sqliteTable("members", { email: text("email").primaryKey() });

export const restaurantMembers = sqliteTable("restaurant_members", { restaurantId: text("restaurant_id").notNull(), email: text("email").notNull() }, table => [primaryKey({columns:[table.restaurantId,table.email]})]);

export const reviews = sqliteTable("reviews", {
 id:text("id").primaryKey(), restaurantId:text("restaurant_id").notNull(),
 rating:integer("rating").notNull(), message:text("message").notNull(),
 name:text("name").notNull().default(""), createdAt:text("created_at").notNull(), readAt:text("read_at")
},table=>[index("reviews_restaurant_created").on(table.restaurantId,table.createdAt)]);

export const waiters=sqliteTable("waiters",{restaurantId:text("restaurant_id").notNull(),email:text("email").notNull(),name:text("name").notNull(),createdAt:text("created_at").notNull()},t=>[primaryKey({columns:[t.restaurantId,t.email]}),index("waiters_email").on(t.email)]);
export const orders=sqliteTable("orders",{id:text("id").primaryKey(),restaurantId:text("restaurant_id").notNull(),restaurantName:text("restaurant_name").notNull(),tableLabel:text("table_label").notNull(),customerName:text("customer_name").notNull().default(""),notes:text("notes").notNull().default(""),items:text("items").notNull(),total:integer("total").notNull(),status:text("status").notNull().default("new"),requestHash:text("request_hash").notNull(),trackingHash:text("tracking_hash"),completedAt:text("completed_at"),completedBy:text("completed_by"),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull()},t=>[index("orders_restaurant_created").on(t.restaurantId,t.createdAt),index("orders_status_created").on(t.status,t.createdAt),index("orders_restaurant_completed").on(t.restaurantId,t.completedAt)]);
