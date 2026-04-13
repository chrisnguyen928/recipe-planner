import {
    pgTable, pgEnum, serial, text, varchar,
    integer, boolean, timestamp, date, numeric
} from 'drizzle-orm/pg-core'

export const unitEnum = pgEnum('unit', ['g', 'kg', 'mL', 'L', 'cup', 'tsp', 'tbsp', 'oz', 'piece'])
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'])
export const daysOfWeekEnum = pgEnum('day_of_week', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 200 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    password: text('password').notNull(),
    createdAt: timestamp('created_at').defaultNow()
})

export const recipes = pgTable('recipes', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    prepTime: integer('pre_time'),
    cookTime: integer('cook_time'),
    servings: integer('servings'),
    createdAt: timestamp('created_at').defaultNow()
})

export const ingredients = pgTable('ingredients', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull().unique()
})

export const recipeIngredients = pgTable('recipe_ingredients', {
    id: serial('id').primaryKey(),
    ingredientId: integer('ingredient_id').references(() => ingredients.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id').references(() => recipes.id),
    quantity: numeric('quantity').notNull(),
    unit: unitEnum('unit').notNull()
})

export const mealPlans = pgTable('meal_plans', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    weekStartDate: date('week_start_date').notNull()
})

export const mealPlanEntries = pgTable('meal_plan_entries', {
    id: serial('id').primaryKey(),
    mealPlanId: integer('meal_plan_id').references(() => mealPlans.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id').references(() => recipes.id),
    dayOfWeek: daysOfWeekEnum('day_of_week').notNull(),
    mealType: mealTypeEnum('meal_type').notNull()
})

export const groceryLists = pgTable('grocery_lists', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at').defaultNow()
})

export const groceryListItems = pgTable('grocery_list_items', {
    id: serial('id').primaryKey(),
    groceryListId: integer('grocery_list_id').references(() => groceryLists.id, { onDelete: 'cascade' }),
    ingredientId: integer('ingredient_id').references(() => ingredients.id),
    totalQuantity: numeric('total_quantity').notNull(),
    unit: unitEnum('unit').notNull(),
    isChecked: boolean('is_checked').default(false)
})