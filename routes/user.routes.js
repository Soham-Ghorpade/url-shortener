import express from "express";
import {db} from "../db/index.js";
import { usersTable } from "../models/user.model.js";
import {signupPostRequestBodySchema , loginPostRequestBodySchema} from '../validation/request.validation.js' 
import { hashPasswordWithSalt } from "../utils/hash.js";
import { getUserByEmail } from "../services/user.service.js";
import { createUserToken } from "../utils/token.js";


const router = express.Router();

router.post("/signup" , async (req, res) => {

    const validationResult =await signupPostRequestBodySchema.safeParseAsync(req.body);

    if (validationResult.error) {
        return res.status(400).json({error: validationResult.error.format()});
    }

    const {firstname, lastname , email , password} = validationResult.data;

    const existingUser = await getUserByEmail(email);

    if(existingUser) 
        return res.
        status(400).
        json({error:`user with email ${email} is already exist`})


    const {salt , password:hassedPassword } = hashPasswordWithSalt(password);

    const [user] = await db
    .insert(usersTable)
    .values({
      email,
      firstname,
      lastname,
      salt,
      password: hassedPassword,
    })
    .returning({ id: usersTable.id });

    return res.status(201).json({
    data: { userId: user.id },
});

})


router.post("/login", async (req, res) => {
    const validationResult =
        await loginPostRequestBodySchema.safeParseAsync(req.body);

    if (!validationResult.success) {
        return res.status(400).json({
            error: validationResult.error.format(),
        });
    }

    const { email, password } = validationResult.data;

    const user = await getUserByEmail(email);

    if (!user) {
        return res.status(400).json({
            error: "Invalid email or password",
        });
    }

    const { password: hashedPassword } =
        hashPasswordWithSalt(password, user.salt);

    if (user.password !== hashedPassword) {
        return res.status(400).json({
            error: "Invalid email or password",
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            error: "Server configuration error",
        });
    }

    const token = await createUserToken({id :user.id})

    return res.status(200).json({ token });
});


export default router;