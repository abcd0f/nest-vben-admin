import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission:code';
export const SYSTEM_ADMIN_KEY = 'permission:system-admin';
export const Permission = (code: string) => SetMetadata(PERMISSION_KEY, code);
export const SystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true);
