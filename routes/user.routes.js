import express from "express";
import {db} from "../db/index.js";
import { usersTable } from "../models/user.model.js";
import {signupPostRequestBodySchema , loginPostRequestBodySchema} from '../validation/request.validation.js' 
import { hashPasswordWithSalt } from "../utils/hash.js";
import { getUserByEmail } from "../services/user.service.js";
import { createUser } from "../services/create.user.js";
import jwt from 'jsonwebtoken';


const router = express.Router();

router.post("/signup" , async (req, res) => {

    const validationResult =await signupPostRequestBodySchema.safeParseAsync(req.body);

    if (validationResult.error) {
        return res.status(400).json({error: validationResult.error.format()});
    }

    const {firstname, lastname , email , password} = validationResult.data;

    const existingUser = await getUserByEmail(email);

    if(existingUser.length >0) 
        return res.
        status(400).
        json({error:`user with email ${email} is already exist`})


    const {salt , password:hassedPassword } = hashPasswordWithSalt(password);

    const user = await createUser(
        firstname,
        lastname,
        email,
        salt,
        hassedPassword,
    );

    return res.status(201).json({data: {userId: user[0].id}})

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

    const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );

    return res.status(200).json({ token });
});


export default router;