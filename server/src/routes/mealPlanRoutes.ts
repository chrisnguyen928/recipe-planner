import express from 'express'
import { getMealPlan, createMealPlan, updateMealPlan, deleteMealPlan } from '../controllers/mealPlanControllers'

const router = express.Router()

router.get('/', getMealPlan)

router.post('/', createMealPlan)

router.put('/:id', updateMealPlan)

router.delete('/:id', deleteMealPlan)

export default router