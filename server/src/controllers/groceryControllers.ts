import type { Request, Response } from 'express'
import { and, eq, like, ilike, inArray } from 'drizzle-orm'

import { db } from '../db/index'
import { groceryLists, groceryListItems, ingredients } from '../db/schema'

type GroceryListContent = {
    id: number,
    ingredient: string,
    quantity: number, 
    unit: 'g' | 'kg' | 'mL' | 'L' | 'cup' | 'tsp' | 'tbsp' | 'oz' | 'piece',
    isChecked: boolean
}

type GroceryListQueryParams = {
    name?: string,
    ingredientName?: string
}

type GroceryList = {
    name?: string,
    items?: GroceryListContent[]
}

export async function getGroceryLists(req: Request<{}, unknown, {}, GroceryListQueryParams>, res: Response) {
    const { name, ingredientName } = req.query

    try {
        const conditions = []

        if (name) {
            conditions.push(ilike(groceryLists.name, `%${name}%`))
        }

        if (ingredientName) {
            const [foundIngredient] = await db
                .select()
                .from(ingredients)
                .where(ilike(ingredients.name, `%${ingredientName}%`))
                .limit(1)

            if (foundIngredient) {
                const matchingIngredients = await db
                    .select({ groceryListId: groceryListItems.groceryListId })
                    .from(groceryListItems)
                    .where(eq(groceryListItems.ingredientId, foundIngredient.id))
                
                const groceryListIds = matchingIngredients.map(entry => entry.groceryListId).filter((id): id is number => id !== null)

                if (groceryListIds.length > 0) {
                    conditions.push(inArray(groceryLists.id, groceryListIds))
                } else {
                    return res.status(200).json([])
                }
            } else {
                return res.status(200).json([])
            }
        }

        const userGroceryLists = await db
            .select()
            .from(groceryLists)
            .where(conditions.length > 0
                ? and(eq(groceryLists.userId, req.user!.userId), ...conditions) : eq(groceryLists.userId, req.user!.userId)
            )
        
        return res.status(200).json(userGroceryLists)
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function createGroceryList(req: Request<{}, unknown, GroceryList, {}>, res: Response) {
    const { name, items } = req.body

    if (!name || !items || items.length === 0) {
        return res.status(400).json({ message: "Please add a name and ingredient to the grocery list" })
    }

    try {
        const existingGroceryList = await db 
            .select()
            .from(groceryLists)
            .where(like(groceryLists.name, `%${name}%`))
            .limit(1)

        if (existingGroceryList.length > 0) {
            return res.status(409).json({ message: "Grocery list already exist" })
        }

        const [newGroceryList] = await db
            .insert(groceryLists)
            .values({
                name,
                userId: req.user!.userId
            })
            .returning({
                id: groceryLists.id,
                userId: groceryLists.userId,
                name: groceryLists.name,
                generatedAt: groceryLists.generatedAt
            })
        
        const newGroceryListItems = await Promise.all(
            items.map(async (itemInput) => {
                if (!itemInput.ingredient || !itemInput.unit || !itemInput.quantity) {
                    throw new Error(`Grocery list item ${itemInput.ingredient} is missing the ingredient, quantity, or unit fields`)
                }
                
                const [existingIngredient] = await db
                    .select()
                    .from(ingredients)
                    .where(ilike(ingredients.name, itemInput.ingredient))
                    .limit(1)
                
                const ingredientItem = existingIngredient ?? await db
                    .insert(ingredients)
                    .values({ name: itemInput.ingredient})
                    .returning({
                        id: ingredients.id,
                        name: ingredients.name
                    })
                    .then(rows => rows[0])
                
                const [groceryItem] = await db
                    .insert(groceryListItems)
                    .values({
                        groceryListId: newGroceryList.id,
                        ingredientId: ingredientItem.id,
                        totalQuantity: String(itemInput.quantity),
                        unit: itemInput.unit,
                        isChecked: false
                    })
                    .returning({
                        totalQuantity: groceryListItems.totalQuantity,
                        unit: groceryListItems.unit,
                        isChecked: groceryListItems.isChecked
                    })
                
                return {
                    name: ingredientItem.name,
                    totalQuantity: groceryItem.totalQuantity,
                    unit: groceryItem.unit,
                    isChecked: groceryItem.isChecked
                }
            })
        )

        return res.status(201).json({
            message: "New grocery list created successfully",
            groceryList: {
                ...newGroceryList,
                groceryListItems: newGroceryListItems
            }
        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function updateGroceryList(req: Request<{id: string}, unknown, GroceryList, {}>, res: Response) {
    const groceryListId = parseInt(req.params.id)
    const { name, items } = req.body

    if (isNaN(groceryListId)) {
        return res.status(400).json({ message: "Invalid grocery list ID" })
    }

    if (!name || !items || items.length === 0) {
        return res.status(400).json({ message: "Please add a name and ingredient to the grocery list" })
    }

    try {
        const [existingGroceryList] = await db
            .select()
            .from(groceryLists)
            .where(and(
                eq(groceryLists.id, groceryListId),
                eq(groceryLists.userId, req.user!.userId)
            ))
            .limit(1)

        if (!existingGroceryList) {
            return res.status(404).json({ message: "Grocery list does not exist" })
        }

        const [updatedGroceryList] = await db
            .update(groceryLists)
            .set({
                name
            })
            .where(eq(groceryLists.id, groceryListId))
            .returning({
                id: groceryLists.id,
                userId: groceryLists.userId,
                name: groceryLists.name
            })
        
        await db 
            .delete(groceryListItems)
            .where(eq(groceryListItems.groceryListId, groceryListId))
        
        const updatedItems = await Promise.all(
            items.map(async (itemInput) => {
                if (!itemInput.ingredient || !itemInput.unit || !itemInput.quantity) {
                    throw new Error(`Grocery list item ${itemInput.ingredient} is missing the ingredient, quantity, or unit fields`)
                }
                
                const [existingIngredient] = await db
                    .select()
                    .from(ingredients)
                    .where(ilike(ingredients.name, itemInput.ingredient))
                    .limit(1)
                
                const ingredientItem = existingIngredient ?? await db
                    .insert(ingredients)
                    .values({ name: itemInput.ingredient})
                    .returning({
                        id: ingredients.id,
                        name: ingredients.name
                    })
                    .then(rows => rows[0])
                
                const [groceryItem] = await db
                    .insert(groceryListItems)
                    .values({
                        groceryListId: updatedGroceryList.id,
                        ingredientId: ingredientItem.id,
                        totalQuantity: String(itemInput.quantity),
                        unit: itemInput.unit,
                        isChecked: itemInput.isChecked
                    })
                    .returning({
                        totalQuantity: groceryListItems.totalQuantity,
                        unit: groceryListItems.unit,
                        isChecked: groceryListItems.isChecked
                    })
                
                return {
                    name: ingredientItem.name,
                    totalQuantity: groceryItem.totalQuantity,
                    unit: groceryItem.unit,
                    isChecked: groceryItem.isChecked
                }
            })
        )

        return res.status(200).json({
            message: "Grocery list updated successfully",
            groceryList: {
                ...updatedGroceryList,
                groceryListItems: updatedItems
            }
        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}

export async function deleteGroceryList(req: Request<{id: string}, unknown, {}, {}>, res: Response) {
    const groceryListId = parseInt(req.params.id)

    if (isNaN(groceryListId)) {
        return res.status(400).json({ message: "Invalid grocery list ID" })
    }

    try {
        const [existingGroceryList] = await db
            .select()
            .from(groceryLists)
            .where(and(
                eq(groceryLists.id, groceryListId),
                eq(groceryLists.userId, req.user!.userId)
            ))
            .limit(1)

        if (!existingGroceryList) {
            return res.status(404).json({ message: "Grocery list does not exist" })
        }

        const [deletedGroceryList] = await db
            .delete(groceryLists)
            .where(and(
                eq(groceryLists.id, groceryListId),
                eq(groceryLists.userId, req.user!.userId)
            ))
            .returning({
                id: groceryLists.id,
                name: groceryLists.name
            })
        
        if (!deletedGroceryList) {
            return res.status(404).json({ message: "Grocery list does not exist" })
        }

        return res.status(200).json({
            message: "Grocery list successfully deleted",
            deleted: deletedGroceryList
        })
    } catch (err) {
        console.error('Full error object: ', JSON.stringify(err, null, 2))
        console.error('Error cause:', (err as any)?.cause)
        console.error('Error message:', (err as any)?.message)
        return res.status(500).json({ message: "Server is unable to handle request" })
    }
}