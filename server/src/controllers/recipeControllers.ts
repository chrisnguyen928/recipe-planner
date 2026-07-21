import type { Request, Response } from 'express'
import { eq, like, ilike, lte, and, inArray } from 'drizzle-orm'

import { db } from '../db/index'
import { recipes, ingredients, recipeIngredients } from '../db/schema'

type IngredientContent = {
    name: string,
    quantity: number,
    unit: 'g' | 'kg' | 'mL' | 'L' | 'cup' | 'tsp' | 'tbsp' | 'oz' | 'piece'
}

type RecipeContent = {
    name?: string,
    description?: string,
    ingredientInputs?: IngredientContent[],
    quantity?: number,
    prepTime?: number,
    cookTime?: number,
    servings?: number
}

export async function getRecipes(req: Request<{}, unknown, {}, RecipeContent>, res: Response) {
    const { name, ingredientInputs, prepTime, cookTime } = req.query

    try {
        const conditions = []

        if (name) {
            conditions.push(ilike(recipes.name, `%${name}%`))
        }

        if (prepTime) {
            conditions.push(lte(recipes.prepTime, prepTime))
        }

        if (cookTime) {
            conditions.push(lte(recipes.cookTime, cookTime))
        }

        if (ingredientInputs) {
            const [foundIngredient] = await db
                .select()
                .from(ingredients)
                .where(ilike(ingredients.name, `%${ingredientInputs}%`))
                .limit(1)

            if (foundIngredient) {
                const matchingRecipeIngredient = await db
                    .select({ recipeId: recipeIngredients.recipeId})
                    .from(recipeIngredients)
                    .where(eq(recipeIngredients.ingredientId, foundIngredient.id))

                const recipeIds = matchingRecipeIngredient.map(ri => ri.recipeId)

                if (recipeIds.length > 0) {
                    conditions.push(inArray(recipes.id, recipeIds))
                } else {
                    return res.status(200).json([])
                }
            } else {
                return res.status(200).json([])
            }
        }

        const userRecipes = await db 
            .select()
            .from(recipes)
            .where(conditions.length > 0 
                ? and(eq(recipes.userId, req.user!.userId), ...conditions) : eq(recipes.userId, req.user!.userId))

        return res.status(200).json(userRecipes)

    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function createRecipe(req: Request<{}, unknown, RecipeContent, {}>, res: Response) {
    const { name, description, ingredientInputs, prepTime, cookTime, servings } = req.body

    if (!name || !ingredientInputs || ingredientInputs.length === 0) {
        return res.status(400).json({ message: "Recipe name and ingredients are required" })
    }

    try {
        const existingRecipe = await db
            .select()
            .from(recipes)
            .where(like(recipes.name, `%${name}%`))
            .limit(1)

        if (existingRecipe.length > 0) {
            return res.status(409).json({ message: "Recipe already exists" })
        }

        const [newRecipe] = await db
            .insert(recipes)
            .values({
                name,
                userId: req.user!.userId,
                description,
                prepTime,
                cookTime,
                servings
            })
            .returning({
                id: recipes.id,
                userId: recipes.userId,
                name: recipes.name,
                description: recipes.description,
                prepTime: recipes.prepTime,
                cookTime: recipes.cookTime,
                servings: recipes.servings,
                createdAt: recipes.createdAt
            })

        const processedIngredients = await Promise.all(
            ingredientInputs.map(async (ingredientInput) => {
                const [existingIngredient] = await db
                    .select()
                    .from(ingredients)
                    .where(like(ingredients.name, ingredientInput.name))
                    .limit(1)

                const ingredient = existingIngredient ?? await db
                    .insert(ingredients)
                    .values({ name: ingredientInput.name })
                    .returning({
                        id: ingredients.id,
                        name: ingredients.name
                    })
                    .then(rows => rows[0])

                const [recipeIngredient] = await db
                    .insert(recipeIngredients)
                    .values({
                        recipeId: newRecipe.id,
                        ingredientId: ingredient.id,
                        quantity: String(ingredientInput.quantity),
                        unit: ingredientInput.unit
                    })
                    .returning({
                        quantity: recipeIngredients.quantity,
                        unit: recipeIngredients.unit
                    })
                
                return {
                    name: ingredient.name,
                    quantity: recipeIngredient.quantity,
                    unit: recipeIngredient.unit
                }
            })
        )

        return res.status(201).json({
            message: "Recipe created successfully",
            recipe: {
                ...newRecipe,
                ingredients: processedIngredients
            }
        })
        
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function updateRecipe(req: Request<{id: string}, unknown, RecipeContent, {}>, res: Response) {
    const recipeId = parseInt(req.params.id)
    const { name, description, ingredientInputs, prepTime, cookTime, servings } = req.body

    if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" })
    }

    if (!name || !ingredientInputs || ingredientInputs.length === 0) {
        return res.status(400).json({ message: "Recipe name and at least one ingredient are required" })
    }

    try {
        const [existingRecipe] = await db
            .select()
            .from(recipes)
            .where(and(
                eq(recipes.id, recipeId),
                eq(recipes.userId, req.user!.userId)
            ))
            .limit(1)
        
        if (!existingRecipe) {
            return res.status(404).json({ message: "Recipe does not exist" })
        }

        const [updatedRecipe] = await db 
            .update(recipes)
            .set({
                name,
                description,
                prepTime,
                cookTime,
                servings
            })
            .where(eq(recipes.id, recipeId))
            .returning({
                id: recipes.id,
                userId: recipes.userId,
                name: recipes.name,
                description: recipes.description,
                prepTime: recipes.prepTime,
                cookTime: recipes.cookTime,
                servings: recipes.servings,
                createdAt: recipes.createdAt
            })
        
        await db
            .delete(recipeIngredients)
            .where(eq(recipeIngredients.recipeId, recipeId))

        const updatedIngredients = await Promise.all(
            ingredientInputs.map(async (ingredientInput) => {
                const [existingIngredient] = await db
                    .select()
                    .from(ingredients)
                    .where(like(ingredients.name, ingredientInput.name))
                    .limit(1)

                const ingredient = existingIngredient ?? await db
                    .insert(ingredients)
                    .values({ name: ingredientInput.name })
                    .returning({
                        id: ingredients.id,
                        name: ingredients.name
                    })
                    .then(rows => rows[0])

                const [recipeIngredient] = await db
                    .insert(recipeIngredients)
                    .values({
                        recipeId: updatedRecipe.id,
                        ingredientId: ingredient.id,
                        quantity: String(ingredientInput.quantity),
                        unit: ingredientInput.unit
                    })
                    .returning({
                        quantity: recipeIngredients.quantity,
                        unit: recipeIngredients.unit
                    })
                
                return {
                    name: ingredient.name,
                    quantity: recipeIngredient.quantity,
                    unit: recipeIngredient.unit
                }
            })
        )

        return res.status(200).json({
            message: "Recipe updated successfully",
            recipe: {
                ...updatedRecipe,
                ingredients: updatedIngredients
            }
        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function deleteRecipe(req: Request<{id: string}, unknown, {}, {}>, res: Response) {
    const recipeId = parseInt(req.params.id)

    if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" })
    }

    try {
        const [existingRecipe] = await db
            .select()
            .from(recipes)
            .where(and(
                eq(recipes.id, recipeId),
                eq(recipes.userId, req.user!.userId)
            ))
            .limit(1)
        
        if (!existingRecipe) {
            return res.status(404).json({ message: "Recipe does not exist" })
        }

        const [deletedRecipe] = await db
        .delete(recipes)
        .where(and(
            eq(recipes.id, recipeId),
            eq(recipes.userId, req.user!.userId)
        ))
        .returning({
            id: recipes.id,
            name: recipes.name
        })

        if (!deletedRecipe) {
            return res.status(404).json({ message: "Recipe does not exist" })
        }

        return res.status(200).json({
            message: "Recipe successfully deleted",
            deleted: deletedRecipe
        })

    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}