import { z } from "zod";
export const dishSchema=z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(100),description:z.string().trim().max(350),price:z.number().min(0).max(100000),category:z.string().trim().min(1).max(40),veg:z.boolean(),available:z.boolean(),secret:z.boolean(),allergens:z.string().max(150),spice:z.enum(["mild","medium","hot"]),taste:z.enum(["savoury","sweet","refreshing"]),image:z.string().max(120000).refine(v=>v===""||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)||/^https:\/\//.test(v)||/^\/api\/dish-image\?/.test(v)).optional()});
export const menuSchema=z.object({active:z.boolean(),name:z.string().trim().min(1).max(70),tagline:z.string().trim().max(120),note:z.string().max(200),dishes:z.array(dishSchema).max(200)});
export type Dish=z.infer<typeof dishSchema>;
export type Menu=z.infer<typeof menuSchema>;
