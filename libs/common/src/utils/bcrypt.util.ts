import bcrypt from 'bcryptjs';

/**
 * BCrypt 密码工具类
 * 复刻 RuoYi-Vue-Plus BCrypt 密码加密验证
 */
export class BcryptUtil {
  /**
   * 默认加密强度
   */
  private static readonly SALT_ROUNDS = 10;

  /**
   * 加密密码
   * @param rawPassword 明文密码
   * @returns BCrypt 哈希值
   */
  static async hashPassword(rawPassword: string): Promise<string> {
    return bcrypt.hash(rawPassword, this.SALT_ROUNDS);
  }

  /**
   * 验证密码
   * @param rawPassword 明文密码
   * @param hashedPassword BCrypt 哈希值
   * @returns 是否匹配
   */
  static async verifyPassword(rawPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(rawPassword, hashedPassword);
  }

  /**
   * 同步加密密码（不推荐用于生产环境）
   * @param rawPassword 明文密码
   * @returns BCrypt 哈希值
   */
  static hashPasswordSync(rawPassword: string): string {
    return bcrypt.hashSync(rawPassword, this.SALT_ROUNDS);
  }

  /**
   * 同步验证密码
   * @param rawPassword 明文密码
   * @param hashedPassword BCrypt 哈希值
   * @returns 是否匹配
   */
  static verifyPasswordSync(rawPassword: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(rawPassword, hashedPassword);
  }
}
