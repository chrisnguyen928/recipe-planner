import express from 'express'
import type { Request, Response } from 'express'

const app = express()

const PORT = 8000

app.use((req: Request, res: Response<{ message: string }>) => {
    res.status(404).json({ message: "No endpoint found" })
})

app.listen(PORT, () => {
    console.log(`Server started on PORT: ${PORT}`)
})