import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'

import { db } from '../db/index'
import { users } from '../db/schema'

dotenv.config()

type authBody = {
    email?: string,
    name?: string,
    password?: string
}

export async function registerUser(req: Request<authBody>, res: Response) {
    const { email, name, password } = req.body

    if (!email || !name || !password) {
        return res.status(400).json({ message: "Please provide the required credentials." })
    }

    try {
        const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

        if (existingUser.length > 0) {
            res.status(409).json({ message: "Email already in use by another user" })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const [newUser] = await db
        .insert(users)
        .values({
            email,
            password: hashedPassword,
            name
        })
        .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            createdAt: users.createdAt
        })

        const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

        return res.status(201).json({
            token,
            user: newUser,
            message: "New user registered successfully"
        })
    } catch (err) {
        console.error('Failed to create new user: ', err)
        res.status(503).json({ message: "Server is unable to handle request" })
    }
}

export async function loginUser(req: Request<authBody>, res: Response) {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required"})
    }

    try {
        const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)

        if (!existingUser) {
            return res.status(409).json({ message: "Invalid email" })
        }

        const passwordIsValid = await bcrypt.compare(password, existingUser.password)

        if (!passwordIsValid) {
            return res.status(401).json({ message: "Invalid password" })
        }

        const token = jwt.sign({ userId: existingUser.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })

        res.status(200).json({
            token,
            user: {
                id: existingUser.id,
                email: existingUser.email,
                name: existingUser.name
            },
            message: "User logged in successfully"
        })

    } catch (err) {
        console.error('Login error: ', err)
        res.status(503).json({ message: "Server is unable to handle request"})
    }
}