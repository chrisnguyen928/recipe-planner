import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

type JwtPayload = {
    userId: number,
    email: string
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header('Authorization')

        if (!authHeader) {
            return res.status(401).json({ message: "No token provided. Authorization denied" })
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "Invalid authorization format. Use: Bearer <token>" })
        }

        const token = authHeader.split(' ')[1]

        const decoded = jwt.verify(token, process.env.JWT_SECRET!)

        // confirm if payload is an obj with the expected shape and if jwt.verify returns JwtPayLoad type
        // before attaching to req.user
        if (typeof decoded === 'string' || !('userId' in decoded) || !('email' in decoded)) {
            return res.status(401).json({ message: "Invalid token payload" })
        }

        req.user = decoded as JwtPayload

        next()
    } catch (err) {
        console.error('Error authenticating: ', err)
        res.status(401).json({ message: "Invalid token provided" })
    }
}

export default authMiddleware