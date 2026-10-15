import {db} from "../db/index.js";
import { usersTable } from "../models/user.model.js";

export async function createUser(
    firstname,
    lastname,
    email,
    salt,
    hashedPassword
){
    const user = await db.insert(usersTable).values({
        firstname,
        lastname,
        email,
        salt,
        password: hashedPassword,
    }).returning({ id: usersTable.id });

    return user;
}
