import {z} from "zod";

export const signupPostRequestBodySchema = z.object({
    firstname: z.string(),
    lastname: z.string().optional(),
    email: z.email(),
    password: z.string().min(3),
});