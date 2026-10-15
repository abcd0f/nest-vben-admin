CREATE TYPE "MenuType" AS ENUM ('DIRECTORY', 'MENU', 'ACTION');

CREATE TABLE "sys_menu" (
  "menu_id" BIGSERIAL NOT NULL,
  "parent_id" BIGINT,
  "menu_type" "MenuType" NOT NULL,
  "menu_name" VARCHAR(64) NOT NULL,
  "route_path" VARCHAR(255),
  "component" VARCHAR(255),
  "permission_code" VARCHAR(128),
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "status" SMALLINT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "sys_menu_pkey" PRIMARY KEY ("menu_id"),
  CONSTRAINT "sys_menu_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sys_menu"("menu_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sys_menu_action_permission_check" CHECK ("menu_type" <> 'ACTION' OR "permission_code" IS NOT NULL)
);
CREATE UNIQUE INDEX "sys_menu_permission_code_key" ON "sys_menu"("permission_code");
CREATE INDEX "sys_menu_parent_id_idx" ON "sys_menu"("parent_id");
CREATE INDEX "sys_menu_deleted_at_idx" ON "sys_menu"("deleted_at");

CREATE TABLE "sys_role_menu" (
  "role_id" BIGINT NOT NULL,
  "menu_id" BIGINT NOT NULL,
  CONSTRAINT "sys_role_menu_pkey" PRIMARY KEY ("role_id", "menu_id"),
  CONSTRAINT "sys_role_menu_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("role_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sys_role_menu_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "sys_menu"("menu_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sys_role_menu_menu_id_idx" ON "sys_role_menu"("menu_id");
