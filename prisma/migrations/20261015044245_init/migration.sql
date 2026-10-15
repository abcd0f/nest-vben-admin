/*
  Warnings:

  - You are about to drop the column `legacy_dept_id` on the `sys_user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sys_user" DROP COLUMN "legacy_dept_id";

-- RenameForeignKey
ALTER TABLE "sys_dept" RENAME CONSTRAINT "sys_dept_parent_fkey" TO "sys_dept_parent_id_fkey";
