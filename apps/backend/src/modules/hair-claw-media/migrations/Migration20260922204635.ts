import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260922204635 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "hair_claw_physical_template" drop constraint if exists "hair_claw_physical_template_slug_unique";`);
    this.addSql(`alter table if exists "hair_claw_color" drop constraint if exists "hair_claw_color_slug_unique";`);
    this.addSql(`alter table if exists "hair_claw_background_template" drop constraint if exists "hair_claw_background_template_slug_unique";`);
    this.addSql(`create table if not exists "hair_claw_background_template" ("id" text not null, "slug" text not null, "name" text not null, "kind" text check ("kind" in ('catalog', 'studio', 'lifestyle', 'seasonal')) not null, "source_asset_key" text null, "positioning" jsonb null, "sort_order" integer not null default 0, "version" integer not null default 1, "status" text check ("status" in ('draft', 'approved', 'retired')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hair_claw_background_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hair_claw_background_template_slug_unique" ON "hair_claw_background_template" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_background_template_deleted_at" ON "hair_claw_background_template" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "hair_claw_color" ("id" text not null, "slug" text not null, "name" text not null, "sort_order" integer not null, "swatch_hex" text null, "reference_asset_key" text null, "processing_parameters" jsonb null, "version" integer not null default 1, "status" text check ("status" in ('draft', 'approved', 'retired')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hair_claw_color_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hair_claw_color_slug_unique" ON "hair_claw_color" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_color_deleted_at" ON "hair_claw_color" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "hair_claw_physical_template" ("id" text not null, "slug" text not null, "name" text not null, "size_label" text not null, "physical_dimensions" jsonb null, "master_asset_key" text null, "transparent_master_key" text null, "claw_body_mask_key" text null, "protected_mask_key" text null, "shadow_asset_key" text null, "geometry" jsonb null, "version" integer not null default 1, "status" text check ("status" in ('draft', 'approved', 'retired')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hair_claw_physical_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hair_claw_physical_template_slug_unique" ON "hair_claw_physical_template" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_physical_template_deleted_at" ON "hair_claw_physical_template" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "hair_claw_design_recipe" ("id" text not null, "design_name" text not null, "design_asset_key" text null, "source_image_key" text null, "claw_body_mask_key" text null, "protected_mask_key" text null, "cutout_asset_key" text null, "shadow_asset_key" text null, "physical_template_id" text not null, "background_template_id" text null, "option_selector" jsonb null, "alignment" jsonb null, "version" integer not null default 1, "status" text check ("status" in ('draft', 'approved', 'retired')) not null default 'draft', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hair_claw_design_recipe_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_design_recipe_physical_template_id" ON "hair_claw_design_recipe" ("physical_template_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_design_recipe_background_template_id" ON "hair_claw_design_recipe" ("background_template_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hair_claw_design_recipe_deleted_at" ON "hair_claw_design_recipe" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "hair_claw_design_recipe" add constraint "hair_claw_design_recipe_physical_template_id_foreign" foreign key ("physical_template_id") references "hair_claw_physical_template" ("id") on update cascade;`);
    this.addSql(`alter table if exists "hair_claw_design_recipe" add constraint "hair_claw_design_recipe_background_template_id_foreign" foreign key ("background_template_id") references "hair_claw_background_template" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "hair_claw_design_recipe" drop constraint if exists "hair_claw_design_recipe_background_template_id_foreign";`);

    this.addSql(`alter table if exists "hair_claw_design_recipe" drop constraint if exists "hair_claw_design_recipe_physical_template_id_foreign";`);

    this.addSql(`drop table if exists "hair_claw_background_template" cascade;`);

    this.addSql(`drop table if exists "hair_claw_color" cascade;`);

    this.addSql(`drop table if exists "hair_claw_physical_template" cascade;`);

    this.addSql(`drop table if exists "hair_claw_design_recipe" cascade;`);
  }

}
