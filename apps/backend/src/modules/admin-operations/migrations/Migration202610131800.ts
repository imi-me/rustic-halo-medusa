import { Migration } from '@medusajs/framework/mikro-orm/migrations'
export class Migration202610131800 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table if not exists "admin_operation" ("id" text not null, "operation_key" text not null, "kind" text not null, "resource_id" text not null, "status" text not null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "admin_operation_pkey" primary key ("id"));',
    )
    this.addSql(
      'create unique index if not exists "IDX_admin_operation_operation_key" on "admin_operation" ("operation_key") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_admin_operation_resource_id" on "admin_operation" ("resource_id") where deleted_at is null;',
    )
    this.addSql(
      'create index if not exists "IDX_admin_operation_deleted_at" on "admin_operation" ("deleted_at") where deleted_at is null;',
    )
  }
  async down(): Promise<void> {
    this.addSql('drop table if exists "admin_operation" cascade;')
  }
}
