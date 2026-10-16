import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { loadAll } from 'js-yaml';
import { extractTargetDdl } from './schema.mjs';

export const SYSTEM_ROOT = 'ruoyi-modules/ruoyi-system/src/main';
export const JAVA_ROOT = `${SYSTEM_ROOT}/java/org/dromara/system`;
const SQL_FILE = 'script/sql/postgres/postgres_ry_vue_5.X.sql';
export const MODULES = ['User', 'Role', 'Menu', 'Dept', 'Post'];

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? walk(join(root, entry.name)) : [join(root, entry.name)])),
  );
  return nested.flat();
}

export function extractEndpoints(source, file) {
  const base = source.match(/@RequestMapping\("([^"]+)"\)/)?.[1];
  if (!base) throw new Error(`Missing controller mapping: ${file}`);
  const endpoints = [];
  let annotations = '';
  let line = 0;
  for (const text of source.split('\n')) {
    line++;
    annotations += `${text}\n`;
    // Only method declarations have an access modifier followed by '(' here.
    const method = text.match(/^\s+public\s+[\w<>?, [\]]+\s+(\w+)\(/)?.[1];
    if (!method) continue;
    const mapping = annotations.match(/@(Get|Post|Put|Delete)Mapping(?:\(([^\n]*)\))?/);
    if (mapping) {
      const pathsExpression = mapping[2]?.split(', consumes')[0] ?? '';
      const paths = [...pathsExpression.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
      const permission = annotations.match(/@SaCheckPermission\("([^"]+)"\)/)?.[1] ?? null;
      const role = annotations.match(/@SaCheckRole\(([\s\S]*?)\)/)?.[1];
      const roles = role
        ? [...role.matchAll(/TenantConstants\.(SUPER_ADMIN_ROLE_KEY|TENANT_ADMIN_ROLE_KEY)/g)].map((match) =>
            match[1] === 'SUPER_ADMIN_ROLE_KEY' ? 'superadmin' : 'admin',
          )
        : [];
      for (const path of paths.length ? paths : ['']) {
        endpoints.push({
          verb: mapping[1].toUpperCase(),
          path: base + path,
          permission,
          roles,
          roleMode: role?.includes('SaMode.OR') ? 'OR' : 'AND',
          method,
          file,
          line,
        });
      }
    }
    // Do not let annotations from one endpoint leak into the next endpoint.
    annotations = '';
  }
  return endpoints;
}

export async function collectBaseline(sourceRoot, backendRoot) {
  const pom = await readFile(join(sourceRoot, 'pom.xml'), 'utf8');
  const version = pom.match(/<revision>([^<]+)<\/revision>/)?.[1];
  if (version !== '5.6.2') throw new Error(`Expected RuoYi-Vue-Plus 5.6.2, received ${version}`);
  const systemFiles = (await walk(join(sourceRoot, SYSTEM_ROOT))).filter((file) =>
    /^(?:I?Sys(?:User|Role|Menu|Dept|Post)(?!Online)\w*|RouterVo|MetaVo|UserInfoVo)\.(?:java|xml)$/.test(
      basename(file),
    ),
  );
  const shared = [
    'pom.xml',
    SQL_FILE,
    'ruoyi-admin/src/main/resources/application.yml',
    'ruoyi-admin/src/main/java/org/dromara/web/service/SysLoginService.java',
    'ruoyi-admin/src/main/java/org/dromara/web/service/impl/PasswordAuthStrategy.java',
    'ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/constant/TenantConstants.java',
    'ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/constant/SystemConstants.java',
    'ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/domain/R.java',
    'ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/domain/model/LoginUser.java',
    'ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/core/domain/BaseEntity.java',
    'ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/core/page/PageQuery.java',
    'ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/core/page/TableDataInfo.java',
    'ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/enums/DataScopeType.java',
    'ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/handler/PlusDataPermissionHandler.java',
    'ruoyi-common/ruoyi-common-satoken/src/main/java/org/dromara/common/satoken/utils/LoginHelper.java',
    'ruoyi-common/ruoyi-common-security/src/main/java/org/dromara/common/security/config/SecurityConfig.java',
    'ruoyi-common/ruoyi-common-tenant/src/main/java/org/dromara/common/tenant/handle/PlusTenantLineHandler.java',
    `${JAVA_ROOT}/service/impl/SysDataScopeServiceImpl.java`,
    `${JAVA_ROOT}/service/impl/SysPermissionServiceImpl.java`,
  ];
  const paths = [
    ...new Set([...systemFiles.map((file) => relative(sourceRoot, file).replaceAll('\\', '/')), ...shared]),
  ].sort();
  const sourceFiles = [];
  for (const path of paths) sourceFiles.push({ path, sha256: sha256(await readFile(join(sourceRoot, path))) });
  const currentFiles = [];
  for (const file of (await walk(join(backendRoot, 'prisma')))
    .filter((file) => /\.(?:prisma|sql)$/.test(file))
    .sort()) {
    currentFiles.push({
      path: relative(backendRoot, file).replaceAll('\\', '/'),
      sha256: sha256(await readFile(file)),
    });
  }
  const endpoints = [];
  for (const module of MODULES) {
    const path = `${JAVA_ROOT}/controller/system/Sys${module}Controller.java`;
    endpoints.push(...extractEndpoints(await readFile(join(sourceRoot, path), 'utf8'), path));
  }
  // Maven filters these scalars before Spring parses the multi-document YAML.
  const application = (
    await readFile(join(sourceRoot, 'ruoyi-admin/src/main/resources/application.yml'), 'utf8')
  ).replace(/(:\s+)(@[\w.-]+@)(?=\s*$)/gm, '$1"$2"');
  const config = Object.assign({}, ...loadAll(application).filter(Boolean));
  const ddl = extractTargetDdl(await readFile(join(sourceRoot, SQL_FILE), 'utf8'));
  return {
    manifest: {
      formatVersion: 1,
      project: 'RuoYi-Vue-Plus',
      version,
      dialect: 'PostgreSQL',
      sourceFiles,
      currentFiles,
    },
    ddl,
    contract: {
      version,
      policy: 'strict-source-parity',
      compatibility: 'none',
      password: 'BCrypt only; existing scrypt hashes require a separately planned reset',
      sourceGaps:
        'Preserve source coverage and session invalidation timing; do not add implicit data-scope checks or global session invalidation',
      authentication: {
        loginRequired: true,
        clientId: 'header OR request parameter must match token clientid',
        excludes: [...config.security.excludes, config.sse.path],
      },
      tenant: config.tenant,
      dataScopeColumns: {
        sys_user: { deptName: 'dept_id', userName: 'create_by' },
        sys_role: { deptName: 'create_dept', userName: 'create_by' },
        sys_dept: { deptName: 'dept_id' },
        sys_post: { deptName: 'dept_id', userName: 'create_by' },
        sys_menu: {},
      },
      endpoints,
    },
  };
}

export async function verifySource(manifest, sourceRoot) {
  const changed = [];
  for (const entry of manifest.sourceFiles) {
    try {
      if (sha256(await readFile(join(sourceRoot, entry.path))) !== entry.sha256) changed.push(entry.path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      changed.push(entry.path);
    }
  }
  if (changed.length) throw new Error(`Frozen upstream source changed:\n${changed.join('\n')}`);
}
