import {randomBytes , createHmac, sign} from "crypto";

export function hashPasswordWithSalt(password){
    const salt = randomBytes(256).toString("hex");
    const hassedPassword = createHmac('sha256', salt)
    .update(password)
    .digest("hex");

    return {salt, password : hassedPassword};
}