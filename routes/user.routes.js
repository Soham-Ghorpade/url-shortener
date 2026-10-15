import express from "express";
import {db} from "../db/index.js";
import { usersTable } from "../models/user.model.js";
import {signupPostRequestBodySchema} from '../validation/request.validation.js' 
import { hashPasswordWithSalt } from "../utils/hash.js";
import { getUserByEmail } from "../services/user.service.js";
import { creatUser } from "../services/create.user.js";

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

export default router;