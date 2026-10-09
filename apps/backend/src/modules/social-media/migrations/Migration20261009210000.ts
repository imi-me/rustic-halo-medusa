import { Migration } from '@medusajs/framework/mikro-orm/migrations'
export class Migration20261009210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "rh_social_post" ("id" text primary key, "title" text not null, "product_id" text null, "product_title" text null, "image_url" text null, "platform" text not null check ("platform" in ('instagram','facebook')), "caption" text not null, "planned_date" text null, "status" text not null default 'draft' check ("status" in ('draft','review','approved')), "version" integer not null default 1, "actor_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
    this.addSql(`create index if not exists "IDX_rh_social_post_deleted_at" on "rh_social_post" ("deleted_at") where deleted_at is null;`)
  }
  override async down(): Promise<void> { this.addSql('drop table if exists "rh_social_post";') }
}
