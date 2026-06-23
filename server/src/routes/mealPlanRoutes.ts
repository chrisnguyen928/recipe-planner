import express from 'express'
import { getMealPlans, createMealPlan, updateMealPlan, deleteMealPlan } from '../controllers/mealPlanControllers'

const router = express.Router()

router.get('/', getMealPlans)

router.post('/', createMealPlan)

router.put('/:id', updateMealPlan)

router.delete('/:id', deleteMealPlan)

export default router