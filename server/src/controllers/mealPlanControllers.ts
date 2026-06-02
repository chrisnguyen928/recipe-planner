import type { Request, Response } from 'express'
import { and, eq, like, ilike, inArray } from 'drizzle-orm'

import { db } from '../db/index'
import { mealPlans, mealPlanEntries, recipes } from '../db/schema'

type RecipeContent = {
    id: number,
    name: string,
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack'
}

type MealPlanContent = {
    name?: string,
    recipe?: RecipeContent[],
    startDate?: string,
}

export async function getMealPlan(req: Request<{}, unknown, {}, MealPlanContent>, res: Response) {
    const { name, recipe } = req.query

    try {
        const conditions = []

        if (name) {
            conditions.push(ilike(mealPlans.name, `%${name}%`))
        }

        if (recipe) {
            const [foundRecipe] = await db
                .select()
                .from(recipes)
                .where(ilike(recipes.name, `%${recipe}%`))
                .limit(1)

            if (foundRecipe) {
                const matchingEntries = await db
                    .select({ mealPlanId: mealPlanEntries.mealPlanId})
                    .from(mealPlanEntries)
                    .where(eq(mealPlanEntries.recipeId, foundRecipe.id))

                const mealPlanIds = matchingEntries.map(entry => entry.mealPlanId).filter((id): id is number => id !== null)

                if (mealPlanIds.length > 0) {
                    conditions.push(inArray(mealPlans.id, mealPlanIds))
                } else {
                    res.status(200).json([])
                }
            } else {
                return res.status(200).json([])
            }
        }

        const userMealPlans = await db 
            .select()
            .from(mealPlans)
            .where(conditions.length > 0
                ? and(eq(mealPlans.userId, req.user!.userId), ...conditions) : eq(mealPlans.userId, req.user!.userId)
            )

        return res.status(200).json(userMealPlans)

    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function createMealPlan(req: Request<{}, unknown, MealPlanContent, {}>, res: Response) {
    const { name, recipe, startDate } = req.body

    if (!name || !startDate || !recipe || recipe.length === 0) {
        return res.status(400).json({ message: "Please fill out the required fields" })
    }

    try {
        const existingMealPlan = await db
            .select()
            .from(mealPlans)
            .where(like(mealPlans.name, `%${name}%`))
            .limit(1)

        if (existingMealPlan.length > 0) {
            return res.status(409).json({ message: "Meal plan already exists" })
        }

        const [newMealPlan] = await db
            .insert(mealPlans)
            .values({
                name,
                userId: req.user!.userId,
                weekStartDate: startDate
            })
            .returning({
                id: mealPlans.id,
                userId: mealPlans.userId,
                name: mealPlans.name,
                weekStartDate: mealPlans.weekStartDate,
                createdAt: mealPlans.createdAt
            })

        const newMealPlanEntries = await Promise.all(
            recipe.map(async (recipeItem) => {
                if (!recipeItem.dayOfWeek || !recipeItem.mealType) {
                    throw new Error(`Recipe ${recipeItem.name} is missing dayOfWeek and mealType field`)
                }

                const [existingRecipe] = await db 
                    .select()
                    .from(recipes)
                    .where(and(
                        eq(recipes.id, recipeItem.id),
                        eq(recipes.userId, req.user!.userId)
                    ))
                    .limit(1)
                
                if (!existingRecipe) {
                    throw new Error(`Recipe with id ${recipeItem.id} not found or does not belong to user`)
                }

                const [newEntry] = await db
                    .insert(mealPlanEntries)
                    .values({
                        mealPlanId: newMealPlan.id,
                        recipeId: recipeItem.id,
                        dayOfWeek: recipeItem.dayOfWeek,
                        mealType: recipeItem.mealType
                    })
                    .returning({
                        id: mealPlanEntries.id,
                        recipeId: mealPlanEntries.recipeId,
                        dayOfWeek: mealPlanEntries.dayOfWeek,
                        mealType: mealPlanEntries.mealType
                    })
                
                return {
                    recipeId: newEntry.recipeId,
                    recipeName: recipeItem.name,
                    dayOfWeek: newEntry.dayOfWeek,
                    mealType: newEntry.mealType
                }
            })
        )

        return res.status(201).json({
            message: "Meal plan successfully created",
            mealPlan: {
                ...newMealPlan,
                entries: newMealPlanEntries
            }
        })
        
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function updateMealPlan(req: Request<{id: string}, unknown, MealPlanContent, {}>, res: Response) {
    const mealPlanId = parseInt(req.params.id)
    const { name, recipe, startDate } = req.body

    if (isNaN(mealPlanId)) {
        return res.status(400).json({ message: "Invalid meal plan ID" })
    }

    if (!name || !startDate || !recipe || recipe.length === 0) {
        return res.status(400).json({ message: "Please fill out the required fields" })
    }

    try {
        const [existingMealPlan] = await db
            .select()
            .from(mealPlans)
            .where(and(
                eq(mealPlans.id, mealPlanId),
                eq(mealPlans.userId, req.user!.userId)
            ))
            .limit(1)

        if (!existingMealPlan) {
            return res.status(404).json({ message: "Meal plan does not exist" })
        }

        const [updatedMealPlan] = await db
            .update(mealPlans)
            .set({
                name,
                weekStartDate: startDate
            })
            .where(eq(mealPlans.id, mealPlanId))
            .returning({
                id: mealPlans.id,
                userId: mealPlans.userId,
                name: mealPlans.name,
                weekStartDate: mealPlans.weekStartDate
            })
        
        await db
            .delete(mealPlanEntries)
            .where(eq(mealPlanEntries.mealPlanId, mealPlanId))

        const updatedEntries = await Promise.all(
            recipe.map(async (recipeItem) => {
                if (!recipeItem.dayOfWeek || !recipeItem.mealType) {
                    throw new Error(`Recipe ${recipeItem.name} is missing dayOfWeek and mealType field`)
                }

                const [existingRecipe] = await db 
                    .select()
                    .from(recipes)
                    .where(and(
                        eq(recipes.id, recipeItem.id),
                        eq(recipes.userId, req.user!.userId)
                    ))
                    .limit(1)
                
                if (!existingRecipe) {
                    throw new Error(`Recipe with id ${recipeItem.id} not found or does not belong to user`)
                }

                const [newEntry] = await db
                    .insert(mealPlanEntries)
                    .values({
                        mealPlanId: updatedMealPlan.id,
                        recipeId: recipeItem.id,
                        dayOfWeek: recipeItem.dayOfWeek,
                        mealType: recipeItem.mealType
                    })
                    .returning({
                        id: mealPlanEntries.id,
                        recipeId: mealPlanEntries.recipeId,
                        dayOfWeek: mealPlanEntries.dayOfWeek,
                        mealType: mealPlanEntries.mealType
                    })
                
                return {
                    recipeId: newEntry.recipeId,
                    recipeName: recipeItem.name,
                    dayOfWeek: newEntry.dayOfWeek,
                    mealType: newEntry.mealType
                }
            })
        )

        return res.status(200).json({
            message: "Meal plan updated successfully",
            mealPlan: {
                ...updatedMealPlan,
                entries: updatedEntries
            }

        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function deleteMealPlan(req: Request<{id: string}, unknown, {}, {}>, res: Response) {
    const mealPlanId = parseInt(req.params.id)

    if (isNaN(mealPlanId)) {
        return res.status(400).json({ message: "Invalid meal plan ID" })
    }

    try {
        const [existingMealPlan] = await db
            .select()
            .from(mealPlans)
            .where(and(
                eq(mealPlans.id, mealPlanId),
                eq(mealPlans.userId, req.user!.userId)
            ))
            .limit(1)
        
        if (!existingMealPlan) {
            return res.status(404).json({ message: "Meal plan does not exist" })
        }

        const [deletedMealPlan] = await db
            .delete(mealPlans)
            .where(and(
                eq(mealPlans.id, mealPlanId),
                eq(mealPlans.userId, req.user!.userId)
            ))
            .returning({
                id: mealPlans.id,
                name: mealPlans.name
            })
        
        return res.status(200).json({
            message: "Meal plan deleted successfully", 
            deleted: deletedMealPlan
        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}