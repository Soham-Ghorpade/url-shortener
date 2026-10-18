import express from "express";
import { shortenPostRequestBodySchema } from "../validation/request.validation.js";
import db from "../db/index.js";
import { usersTable } from "../models/user.model.js";
import { urlsTable } from "../models/url.model.js";
import {nanoid} from "nanoid";
import { ensureAuthenticated } from "../middlewares/auth.middleware.js";
import {and , eq} from 'drizzle-orm'



const router = express.Router();

router.delete("/:id",ensureAuthenticated,async function(req,res){
    const id = req.params.id;
    await db.delete(urlsTable).where(and(eq(urlsTable.id , id),eq(urlsTable.userId,req.user.id)))
    return res.status(200).json({deleted:true})
})

router.post("/shorten",ensureAuthenticated,async function(req, res){
    
    const validationResult = await shortenPostRequestBodySchema.safeParseAsync(req.body)

    if (validationResult.error) {
        return res.status(400).json({error: validationResult.error})
    }

    const {url,code} = validationResult.data

    const shortCode = code ?? nanoid(6)

    let result;
    try {
        const [inserted] = await db.insert(urlsTable).values({
            shortCode , 
            targetURL : url,
            userId : req.user.id,  
        }).returning({
            id: urlsTable.id , 
            shortCode: urlsTable.shortCode ,
            targetURL: urlsTable.targetURL
        });
        result = inserted;
    } catch (err) {
        if (err?.code === '23505' || err?.cause?.code === '23505') {
            return res.status(409).json({ error: "that short code is already taken" });
        }
        return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(201).json({
        id: result.id ,
        shortCode : result.shortCode ,
        targetURL: result.targetURL,
    })    
})

router.get("/codes",ensureAuthenticated, async function(req,res){
    const codes = await db
        .select()
        .from(urlsTable)
        .where(eq(urlsTable.userId, req.user.id))
    return res.json({ codes });
})

router.get('/:shortCode', async function(req,res){
    const code = req.params.shortCode
    const [result] = await db.select({
        targetURL: urlsTable.targetURL,
    }).from(urlsTable).where(eq(urlsTable.shortCode, code))

    if (!result){
        return res.status(404).json({error:"Invalid URL"})
    }

    return res.redirect(result.targetURL)
})

export default router;