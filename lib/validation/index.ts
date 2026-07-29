import { z } from "zod";
export const demoQuerySchema=z.object({tenant:z.enum(["furiver","crisenix"]).optional(),theme:z.enum(["explorer","lavella"]).optional(),view:z.enum(["public","admin"]).optional()});
export const simulatedUploadSchema=z.object({name:z.string().max(120),size:z.number().max(5_000_000),type:z.enum(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"])});
