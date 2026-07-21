import express from 'express'
import { registerUser, loginUser, logoutUser, verifyUser } from '../controllers/authControllers'

const router = express.Router()

router.post('/register', registerUser)

router.post('/login', loginUser)

router.post('/logout', logoutUser)

router.get('/verify', verifyUser)

export default router