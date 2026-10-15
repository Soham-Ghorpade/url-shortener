import express from "express";
import {db} from "../db/index.js";
import { eq } from "drizzle-orm";
import { usersTable } from "../models/user.model.js";
import {randomBytes , createHmac, sign} from "crypto";
import {signupPostRequestBodySchema} from '../validation/request.validation.js' 

const router = express.Router();

router.post("/signup" , async (req, res) => {
    const validationResult =await signupPostRequestBodySchema.safeParseAsync(req.body);

    if (validationResult.error) {
        return res.status(400).json({error: validationResult.error.format()});
    }

    const {firstname, lastname , email , password} = validationResult.data;

    const existingUser = await db
    .select({id: usersTable.id})
    .from(usersTable)
    .where(eq(usersTable.email,email))

    if(existingUser.length >0) 
        return res.
        status(400).
        json({error:`user with email ${email} is already exist`})


    const salt = randomBytes(256).toString("hex");
    const hassedPassword = createHmac('sha256', salt)
    .update(password)
    .digest("hex");

    const user = await db.insert(usersTable).values({
        email,
        firstname,
        lastname,
        salt,
        password: hassedPassword,
    }).returning({id: usersTable.id})

    return res.status(201).json({data: {userId: user[0].id}})

})

export default router;