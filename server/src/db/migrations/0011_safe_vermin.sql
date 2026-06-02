ALTER TABLE "meal_plan_entries" DROP CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;