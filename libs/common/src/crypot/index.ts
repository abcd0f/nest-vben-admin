/**
 * `crypot` —— 通用加解密工具集（纯函数，零第三方依赖）。
 *
 * 全部基于 Node 内置 `node:crypto`，不引入任何外部加密库：
 *
 * - **AES**：`aesEncrypt` / `aesDecrypt`，支持 GCM（默认，AEAD）与 CBC；
 * - **RSA**：`generateRsaKeyPair` / `rsaEncrypt` / `rsaDecrypt` / `rsaSign` / `rsaVerify`；
 * - **SM3**：`sm3` / `hmacSm3`；
 * - **SM4**：`sm4Encrypt` / `sm4Decrypt`，支持 ECB / CBC / CTR / CFB / OFB。
 *
 * 说明：**SM2（国密非对称）暂未实现**——Node 内置 `crypto` 不支持 SM2 密钥类型
 * （既没有 `sm2` key type，`ec` 也不认 `sm2` 曲线），需要引入第三方库或手写椭圆曲线运算，
 * 属于后续独立议题。
 *
 * 所有函数都以**显式参数**接收密钥 / IV，不读取全局配置、不依赖 NestJS 容器。
 */
export * from './aes.util.js';
export * from './bytes.util.js';
export * from './rsa.util.js';
export * from './sm3.util.js';
export * from './sm4.util.js';
