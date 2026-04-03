import {
    pgTable, pgEnum, serial, text, varchar,
    integer, boolean, timestamp, date, numeric
} from 'drizzle-orm/pg-core'

export const unitEnum = pgEnum('unit', ['g', 'kg', 'mL', 'L', 'cup', 'tsp', 'tbsp', 'oz', 'piece'])
export const mealTypeEnum = pgEnum('meal_type', ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'])
export const daysOfWeekEnum = pgEnum('day_of_week', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])

