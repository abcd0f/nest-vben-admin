BEGIN;

-- The existing installation was audited as empty. Refuse a later deployment
-- with unmapped records instead of silently assigning a tenant or losing IDs.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sys_user) OR EXISTS (SELECT 1 FROM sys_role)
       OR EXISTS (SELECT 1 FROM sys_menu) OR EXISTS (SELECT 1 FROM sys_dept)
       OR EXISTS (SELECT 1 FROM sys_post) OR EXISTS (SELECT 1 FROM sys_user_role)
       OR EXISTS (SELECT 1 FROM sys_role_menu) OR EXISTS (SELECT 1 FROM sys_role_dept)
       OR EXISTS (SELECT 1 FROM sys_user_post) THEN
        RAISE EXCEPTION 'RuoYi schema migration requires an empty audited nine-table dataset; prepare explicit data mappings before retrying';
    END IF;
END $$;

DROP TABLE sys_user_post, sys_user_role, sys_role_menu, sys_role_dept;
DROP TABLE sys_user, sys_post, sys_role, sys_menu, sys_dept;
DROP TYPE "DataScope", "MenuType";

-- Frozen from docs/ruoyi/phase0/target.sql (RuoYi-Vue-Plus 5.6.2 PostgreSQL).
create table if not exists sys_dept
(
    dept_id     int8,
    tenant_id   varchar(20) default '000000'::varchar,
    parent_id   int8        default 0,
    ancestors   varchar(500)default ''::varchar,
    dept_name   varchar(30) default ''::varchar,
    dept_category varchar(100) default null::varchar,
    order_num   int4        default 0,
    leader      int8        default null,
    phone       varchar(11) default null::varchar,
    email       varchar(50) default null::varchar,
    status      char        default '0'::bpchar,
    del_flag    char        default '0'::bpchar,
    create_dept int8,
    create_by   int8,
    create_time timestamp,
    update_by   int8,
    update_time timestamp,
    constraint "sys_dept_pk" primary key (dept_id)
);

create table if not exists sys_menu
(
    menu_id     int8,
    menu_name   varchar(50) not null,
    parent_id   int8         default 0,
    order_num   int4         default 0,
    path        varchar(200) default ''::varchar,
    component   varchar(255) default null::varchar,
    query_param varchar(255) default null::varchar,
    is_frame    char         default '1'::bpchar,
    is_cache    char         default '0'::bpchar,
    menu_type   char         default ''::bpchar,
    visible     char         default '0'::bpchar,
    status      char         default '0'::bpchar,
    perms       varchar(100) default null::varchar,
    icon        varchar(100) default '#'::varchar,
    create_dept int8,
    create_by   int8,
    create_time timestamp,
    update_by   int8,
    update_time timestamp,
    remark      varchar(500) default ''::varchar,
    constraint "sys_menu_pk" primary key (menu_id)
);

create table if not exists sys_post
(
    post_id     int8,
    tenant_id   varchar(20) default '000000'::varchar,
    dept_id     int8,
    post_code   varchar(64) not null,
    post_category   varchar(100) default null,
    post_name   varchar(50) not null,
    post_sort   int4        not null,
    status      char        not null,
    create_dept int8,
    create_by   int8,
    create_time timestamp,
    update_by   int8,
    update_time timestamp,
    remark      varchar(500) default null::varchar,
    constraint "sys_post_pk" primary key (post_id)
);

create table if not exists sys_role
(
    role_id             int8,
    tenant_id           varchar(20)  default '000000'::varchar,
    role_name           varchar(30)  not null,
    role_key            varchar(100) not null,
    role_sort           int4         not null,
    data_scope          char         default '1'::bpchar,
    menu_check_strictly bool         default true,
    dept_check_strictly bool         default true,
    status              char         not null,
    del_flag            char         default '0'::bpchar,
    create_dept         int8,
    create_by           int8,
    create_time         timestamp,
    update_by           int8,
    update_time         timestamp,
    remark              varchar(500) default null::varchar,
    constraint "sys_role_pk" primary key (role_id)
);

create table if not exists sys_role_dept
(
    role_id int8 not null,
    dept_id int8 not null,
    constraint sys_role_dept_pk primary key (role_id, dept_id)
);

create table if not exists sys_role_menu
(
    role_id int8 not null,
    menu_id int8 not null,
    constraint sys_role_menu_pk primary key (role_id, menu_id)
);

create table if not exists sys_user
(
    user_id     int8,
    tenant_id   varchar(20)  default '000000'::varchar,
    dept_id     int8,
    user_name   varchar(30)  not null,
    nick_name   varchar(30)  not null,
    user_type   varchar(10)  default 'sys_user'::varchar,
    email       varchar(50)  default ''::varchar,
    phonenumber varchar(11)  default ''::varchar,
    sex         char         default '0'::bpchar,
    avatar      int8,
    password    varchar(100) default ''::varchar,
    status      char         default '0'::bpchar,
    del_flag    char         default '0'::bpchar,
    login_ip    varchar(128) default ''::varchar,
    login_date  timestamp,
    create_dept int8,
    create_by   int8,
    create_time timestamp,
    update_by   int8,
    update_time timestamp,
    remark      varchar(500) default null::varchar,
    constraint "sys_user_pk" primary key (user_id)
);

create table if not exists sys_user_post
(
    user_id int8 not null,
    post_id int8 not null,
    constraint sys_user_post_pk primary key (user_id, post_id)
);

create table if not exists sys_user_role
(
    user_id int8 not null,
    role_id int8 not null,
    constraint sys_user_role_pk primary key (user_id, role_id)
);

COMMIT;
