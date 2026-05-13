import express from 'express'
import { getRecipes, createRecipe, updateRecipe, deleteRecipe } from '../controllers/recipeControllers'

const router = express.Router()

router.get('/', getRecipes)

router.post('/', createRecipe)

router.put('/:id', updateRecipe)

router.delete('/:id')

export default router