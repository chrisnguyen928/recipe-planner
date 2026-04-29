import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

pool.connect((err, client, release) => {
    if (err) {
        console.error('Failed to connect to database: ', err.message)
    } else {
        console.log('Database connection was successful')
        release()
    }
})

export const db = drizzle(pool, { schema })