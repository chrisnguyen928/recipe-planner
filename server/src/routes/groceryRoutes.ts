import express from 'express'
import { getGroceryLists, createGroceryList, updateGroceryList, deleteGroceryList } from '../controllers/groceryControllers'

const router = express.Router()

router.get('/', getGroceryLists)

router.post('/', createGroceryList)

router.put('/:id', updateGroceryList)

router.delete('/:id', deleteGroceryList)

export default router