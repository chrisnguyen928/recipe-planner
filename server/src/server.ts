import express from 'express'
import type { Request, Response } from 'express'
import { db } from './db/index'
import authRoutes from './routes/authRoutes'
import recipeRoutes from './routes/recipeRoutes'

const app = express()

const PORT = 8000

app.use(express.json())

app.use('/api/recipes', recipeRoutes)
app.use('/api/auth', authRoutes)

app.use((req: Request, res: Response<{ message: string }>) => {
    res.status(404).json({ message: "No endpoint found" })
})

app.listen(PORT, () => {
    console.log(`Server started on PORT: ${PORT}`)
})