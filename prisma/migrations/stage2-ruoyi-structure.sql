-- Stage 2 Migration: 复刻 RuoYi-Vue-Plus 系统模块结构
-- 警告：此迁移会大幅修改表结构，执行前务必备份数据

-- ============================================
-- 1. 用户表 (sys_user) 结构变更
-- ============================================

-- 添加新列
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000';
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS user_type VARCHAR(10) DEFAULT '00';
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS create_dept BIGINT;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS create_by BIGINT;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS update_by BIGINT;
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 重命名列
ALTER TABLE sys_user RENAME COLUMN username TO user_name;
ALTER TABLE sys_user RENAME COLUMN nickname TO nick_name;
ALTER TABLE sys_user RENAME COLUMN phone TO phonenumber;
ALTER TABLE sys_user RENAME COLUMN created_time TO create_time;
ALTER TABLE sys_user RENAME COLUMN updated_time TO update_time;
ALTER TABLE sys_user RENAME COLUMN login_date TO login_date;

-- 修改列类型和约束
ALTER TABLE sys_user ALTER COLUMN user_name TYPE VARCHAR(30);
ALTER TABLE sys_user ALTER COLUMN nick_name TYPE VARCHAR(30);
ALTER TABLE sys_user ALTER COLUMN nick_name SET NOT NULL;
ALTER TABLE sys_user ALTER COLUMN phonenumber TYPE VARCHAR(11);
ALTER TABLE sys_user ALTER COLUMN email TYPE VARCHAR(50);
ALTER TABLE sys_user ALTER COLUMN password TYPE VARCHAR(100);
ALTER TABLE sys_user ALTER COLUMN login_ip TYPE VARCHAR(128);

-- 添加新的性别列（字符类型）
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS sex_new CHAR(1) DEFAULT '0';
UPDATE sys_user SET sex_new = CASE WHEN sex = 0 THEN '0' WHEN sex = 1 THEN '1' ELSE '2' END;
ALTER TABLE sys_user DROP COLUMN IF EXISTS sex;
ALTER TABLE sys_user RENAME COLUMN sex_new TO sex;

-- 头像字段改为 BIGINT
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS avatar_new BIGINT;
-- 注意：avatar URL 到 OSS ID 的转换需要单独的数据迁移脚本
ALTER TABLE sys_user DROP COLUMN IF EXISTS avatar CASCADE;
ALTER TABLE sys_user RENAME COLUMN avatar_new TO avatar;

-- 状态字段转换：旧 0=禁用 1=正常 → 新 '0'=正常 '1'=停用
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS status_new CHAR(1) DEFAULT '0';
UPDATE sys_user SET status_new = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE '1' END;
ALTER TABLE sys_user DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE sys_user RENAME COLUMN status_new TO status;

-- 删除标志转换：is_del (0/1) → del_flag ('0'/'2')
ALTER TABLE sys_user ADD COLUMN IF NOT EXISTS del_flag CHAR(1) DEFAULT '0';
UPDATE sys_user SET del_flag = CASE WHEN is_del = 1 THEN '2' ELSE '0' END;
ALTER TABLE sys_user DROP COLUMN IF EXISTS is_del CASCADE;

-- 删除旧的唯一约束（目标 DDL 没有）
ALTER TABLE sys_user DROP CONSTRAINT IF EXISTS sys_user_username_key;
ALTER TABLE sys_user DROP CONSTRAINT IF EXISTS sys_user_email_key;
ALTER TABLE sys_user DROP CONSTRAINT IF EXISTS sys_user_phone_key;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_sys_user_tenant_id ON sys_user(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_user_dept_id ON sys_user(dept_id);
CREATE INDEX IF NOT EXISTS idx_sys_user_del_flag ON sys_user(del_flag);

-- ============================================
-- 2. 部门表 (sys_dept) 结构变更
-- ============================================

-- 添加新列
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000';
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS ancestors VARCHAR(500) DEFAULT '';
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS dept_category VARCHAR(100);
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS leader VARCHAR(20);
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS phone VARCHAR(11);
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS email VARCHAR(50);
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS create_dept BIGINT;
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS create_by BIGINT;
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS update_by BIGINT;

-- 重命名列
ALTER TABLE sys_dept RENAME COLUMN dept_name TO dept_name;
ALTER TABLE sys_dept RENAME COLUMN sort_order TO order_num;
ALTER TABLE sys_dept RENAME COLUMN created_time TO create_time;
ALTER TABLE sys_dept RENAME COLUMN updated_time TO update_time;

-- 修改列类型
ALTER TABLE sys_dept ALTER COLUMN dept_name TYPE VARCHAR(30);

-- 父节点 NULL 转换为 0
UPDATE sys_dept SET parent_id = 0 WHERE parent_id IS NULL;
ALTER TABLE sys_dept ALTER COLUMN parent_id SET DEFAULT 0;
ALTER TABLE sys_dept ALTER COLUMN parent_id SET NOT NULL;

-- 状态字段转换
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS status_new CHAR(1) DEFAULT '0';
UPDATE sys_dept SET status_new = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE '1' END;
ALTER TABLE sys_dept DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE sys_dept RENAME COLUMN status_new TO status;

-- 删除标志转换
ALTER TABLE sys_dept ADD COLUMN IF NOT EXISTS del_flag CHAR(1) DEFAULT '0';
UPDATE sys_dept SET del_flag = CASE WHEN is_del = 1 THEN '2' ELSE '0' END;
ALTER TABLE sys_dept DROP COLUMN IF EXISTS is_del CASCADE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sys_dept_tenant_id ON sys_dept(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_dept_parent_id ON sys_dept(parent_id);
CREATE INDEX IF NOT EXISTS idx_sys_dept_del_flag ON sys_dept(del_flag);

-- ============================================
-- 3. 岗位表 (sys_post) 结构变更
-- ============================================

-- 添加新列
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000';
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS dept_id BIGINT;
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS post_category VARCHAR(100);
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS create_dept BIGINT;
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS create_by BIGINT;
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS update_by BIGINT;
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 重命名列
ALTER TABLE sys_post RENAME COLUMN sort_order TO post_sort;
ALTER TABLE sys_post RENAME COLUMN created_time TO create_time;
ALTER TABLE sys_post RENAME COLUMN updated_time TO update_time;

-- 修改列类型
ALTER TABLE sys_post ALTER COLUMN post_name TYPE VARCHAR(50);

-- 状态字段转换
ALTER TABLE sys_post ADD COLUMN IF NOT EXISTS status_new CHAR(1) DEFAULT '0';
UPDATE sys_post SET status_new = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE '1' END;
ALTER TABLE sys_post DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE sys_post RENAME COLUMN status_new TO status;

-- 岗位表没有 del_flag，删除 is_del
ALTER TABLE sys_post DROP COLUMN IF EXISTS is_del CASCADE;

-- 删除唯一约束
ALTER TABLE sys_post DROP CONSTRAINT IF EXISTS sys_post_post_code_key;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sys_post_tenant_id ON sys_post(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_post_dept_id ON sys_post(dept_id);

-- 添加部门外键（如果需要）
-- ALTER TABLE sys_post ADD CONSTRAINT fk_post_dept FOREIGN KEY (dept_id) REFERENCES sys_dept(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 4. 角色表 (sys_role) 结构变更
-- ============================================

-- 添加新列
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(20) DEFAULT '000000';
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS role_key VARCHAR(100);
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS role_sort INT DEFAULT 0;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS menu_check_strictly BOOLEAN DEFAULT TRUE;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS dept_check_strictly BOOLEAN DEFAULT TRUE;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS create_dept BIGINT;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS create_by BIGINT;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS update_by BIGINT;
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 重命名列
ALTER TABLE sys_role RENAME COLUMN role_code TO role_key_temp;
ALTER TABLE sys_role RENAME COLUMN created_time TO create_time;
ALTER TABLE sys_role RENAME COLUMN updated_time TO update_time;

-- 如果 role_key 已存在，使用它；否则使用 role_code
UPDATE sys_role SET role_key = role_key_temp WHERE role_key IS NULL;
ALTER TABLE sys_role DROP COLUMN IF EXISTS role_key_temp;

-- 修改列类型
ALTER TABLE sys_role ALTER COLUMN role_name TYPE VARCHAR(30);

-- data_scope 从枚举转为 CHAR(1)
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS data_scope_new CHAR(1) DEFAULT '1';
-- 枚举映射：ALL=1, CUSTOM=2, DEPT=3, DEPT_AND_CHILDREN=4, SELF=5
-- 需要根据实际枚举值调整
UPDATE sys_role SET data_scope_new = '5'; -- 默认仅本人
ALTER TABLE sys_role DROP COLUMN IF EXISTS data_scope CASCADE;
ALTER TABLE sys_role RENAME COLUMN data_scope_new TO data_scope;

-- 状态字段转换
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS status_new CHAR(1) DEFAULT '0';
UPDATE sys_role SET status_new = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE '1' END;
ALTER TABLE sys_role DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE sys_role RENAME COLUMN status_new TO status;

-- 删除标志转换
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS del_flag CHAR(1) DEFAULT '0';
UPDATE sys_role SET del_flag = CASE WHEN is_del = 1 THEN '2' ELSE '0' END;
ALTER TABLE sys_role DROP COLUMN IF EXISTS is_del CASCADE;

-- 删除 is_system 列
ALTER TABLE sys_role DROP COLUMN IF EXISTS is_system CASCADE;

-- 删除唯一约束
ALTER TABLE sys_role DROP CONSTRAINT IF EXISTS sys_role_role_code_key;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sys_role_tenant_id ON sys_role(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sys_role_del_flag ON sys_role(del_flag);

-- ============================================
-- 5. 菜单表 (sys_menu) 结构变更
-- ============================================

-- 添加新列
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS path VARCHAR(200);
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS query_param VARCHAR(255);
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS is_frame CHAR(1) DEFAULT '1';
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS is_cache CHAR(1) DEFAULT '0';
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS visible CHAR(1) DEFAULT '1';
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS icon VARCHAR(100);
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS create_dept BIGINT;
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS create_by BIGINT;
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS update_by BIGINT;
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS remark VARCHAR(500);

-- 重命名列
ALTER TABLE sys_menu RENAME COLUMN sort_order TO order_num;
ALTER TABLE sys_menu RENAME COLUMN route_path TO path_temp;
ALTER TABLE sys_menu RENAME COLUMN permission_code TO perms;
ALTER TABLE sys_menu RENAME COLUMN created_time TO create_time;
ALTER TABLE sys_menu RENAME COLUMN updated_time TO update_time;

-- 如果 path 已存在，使用它
UPDATE sys_menu SET path = path_temp WHERE path IS NULL;
ALTER TABLE sys_menu DROP COLUMN IF EXISTS path_temp;

-- 修改列类型
ALTER TABLE sys_menu ALTER COLUMN menu_name TYPE VARCHAR(50);
ALTER TABLE sys_menu ALTER COLUMN perms TYPE VARCHAR(100);

-- 父节点 NULL 转换为 0
UPDATE sys_menu SET parent_id = 0 WHERE parent_id IS NULL;
ALTER TABLE sys_menu ALTER COLUMN parent_id SET DEFAULT 0;
ALTER TABLE sys_menu ALTER COLUMN parent_id SET NOT NULL;

-- menu_type 从枚举转为 CHAR(1)：DIRECTORY→M, MENU→C, ACTION→F
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS menu_type_new CHAR(1);
UPDATE sys_menu SET menu_type_new = CASE
  WHEN menu_type::text = 'DIRECTORY' THEN 'M'
  WHEN menu_type::text = 'MENU' THEN 'C'
  WHEN menu_type::text = 'ACTION' THEN 'F'
  ELSE 'F'
END;
ALTER TABLE sys_menu DROP COLUMN IF EXISTS menu_type CASCADE;
ALTER TABLE sys_menu RENAME COLUMN menu_type_new TO menu_type;

-- 状态字段转换
ALTER TABLE sys_menu ADD COLUMN IF NOT EXISTS status_new CHAR(1) DEFAULT '0';
UPDATE sys_menu SET status_new = CASE WHEN status = 1 THEN '0' WHEN status = 0 THEN '1' ELSE '1' END;
ALTER TABLE sys_menu DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE sys_menu RENAME COLUMN status_new TO status;

-- 菜单表没有 del_flag，删除 is_del
ALTER TABLE sys_menu DROP COLUMN IF EXISTS is_del CASCADE;

-- 删除唯一约束
ALTER TABLE sys_menu DROP CONSTRAINT IF EXISTS sys_menu_permission_code_key;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sys_menu_parent_id ON sys_menu(parent_id);

-- ============================================
-- 6. 关系表变更
-- ============================================

-- sys_user_role: 移除外键约束（目标没有）
ALTER TABLE sys_user_role DROP CONSTRAINT IF EXISTS sys_user_role_user_id_fkey;
ALTER TABLE sys_user_role DROP CONSTRAINT IF EXISTS sys_user_role_role_id_fkey;

-- sys_user_post: 移除外键约束
ALTER TABLE sys_user_post DROP CONSTRAINT IF EXISTS sys_user_post_user_id_fkey;
ALTER TABLE sys_user_post DROP CONSTRAINT IF EXISTS sys_user_post_post_id_fkey;

-- sys_role_menu: 级联删除改为 CASCADE
ALTER TABLE sys_role_menu DROP CONSTRAINT IF EXISTS sys_role_menu_role_id_fkey;
ALTER TABLE sys_role_menu DROP CONSTRAINT IF EXISTS sys_role_menu_menu_id_fkey;

-- sys_role_dept: 级联删除改为 CASCADE
ALTER TABLE sys_role_dept DROP CONSTRAINT IF EXISTS sys_role_dept_role_id_fkey;
ALTER TABLE sys_role_dept DROP CONSTRAINT IF EXISTS sys_role_dept_dept_id_fkey;

-- ============================================
-- 7. 数据回填：部门 ancestors 路径
-- ============================================

-- 创建递归函数计算 ancestors
CREATE OR REPLACE FUNCTION calculate_ancestors(dept_id_param BIGINT)
RETURNS VARCHAR(500) AS $$
DECLARE
  result VARCHAR(500) := '';
  current_id BIGINT := dept_id_param;
  parent_id_val BIGINT;
BEGIN
  LOOP
    SELECT parent_id INTO parent_id_val FROM sys_dept WHERE dept_id = current_id;

    IF parent_id_val IS NULL OR parent_id_val = 0 THEN
      EXIT;
    END IF;

    IF result = '' THEN
      result := parent_id_val::TEXT;
    ELSE
      result := parent_id_val::TEXT || ',' || result;
    END IF;

    current_id := parent_id_val;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 更新所有部门的 ancestors
UPDATE sys_dept SET ancestors = calculate_ancestors(dept_id);

-- 删除函数
DROP FUNCTION IF EXISTS calculate_ancestors(BIGINT);

-- ============================================
-- 完成
-- ============================================

COMMENT ON TABLE sys_user IS 'Stage 2 迁移完成：RuoYi-Vue-Plus 用户表结构';
COMMENT ON TABLE sys_dept IS 'Stage 2 迁移完成：RuoYi-Vue-Plus 部门表结构';
COMMENT ON TABLE sys_post IS 'Stage 2 迁移完成：RuoYi-Vue-Plus 岗位表结构';
COMMENT ON TABLE sys_role IS 'Stage 2 迁移完成：RuoYi-Vue-Plus 角色表结构';
COMMENT ON TABLE sys_menu IS 'Stage 2 迁移完成：RuoYi-Vue-Plus 菜单表结构';
