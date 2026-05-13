ALTER TABLE "grocery_list_items" DROP CONSTRAINT "grocery_list_items_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;