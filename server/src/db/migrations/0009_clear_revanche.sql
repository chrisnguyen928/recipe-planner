ALTER TABLE "meal_plans" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "created_at";