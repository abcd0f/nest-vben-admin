import type { ArgumentMetadata } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BusinessException } from '../exceptions/index.js';
import { AppValidationPipe, flattenValidationErrors } from './validation.pipe.js';

class QueryDto {
  @IsInt()
  @Min(1)
  page!: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

class NestedDto {
  @IsOptional()
  filter?: QueryDto;
}

const queryMeta: ArgumentMetadata = { type: 'query', metatype: QueryDto };

describe('appValidationPipe', () => {
  const pipe = new AppValidationPipe();

  it('合法参数正常通过并转成 DTO 实例', async () => {
    const result = await pipe.transform({ page: 1, keyword: 'abc' }, queryMeta);

    expect(result).toBeInstanceOf(QueryDto);
    expect(result).toMatchObject({ page: 1, keyword: 'abc' });
  });

  it('非法参数抛 BusinessException，业务码为 422', async () => {
    await expect(pipe.transform({ page: 'abc' }, queryMeta)).rejects.toBeInstanceOf(BusinessException);
  });

  it('校验失败时 details 带字段级错误', async () => {
    try {
      await pipe.transform({ page: 0 }, queryMeta);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);

      const business = error as BusinessException;
      expect(business.code).toBe(422);
      expect(business.details).toEqual([{ field: 'page', message: expect.any(String) }]);
    }
  });

  it('whitelist 剥掉 DTO 未声明的字段', async () => {
    const result = await pipe.transform({ page: 1, injected: 'x' }, queryMeta);

    expect(result).not.toHaveProperty('injected');
  });
});

describe('flattenValidationErrors', () => {
  it('递归展开嵌套 DTO 的字段错误，路径用点连接', () => {
    const flattened = flattenValidationErrors([
      {
        property: 'filter',
        children: [
          {
            property: 'page',
            constraints: { isInt: 'page must be an integer number' },
            children: [],
          },
        ],
      } as never,
    ]);

    expect(flattened).toEqual([{ field: 'filter.page', message: 'page must be an integer number' }]);
  });

  it('嵌套对象自身的错误与子字段错误都会保留', () => {
    const flattened = flattenValidationErrors([
      {
        property: 'filter',
        constraints: { isObject: 'filter must be an object' },
        children: [{ property: 'page', constraints: { min: 'page must not be less than 1' }, children: [] }],
      } as never,
    ]);

    expect(flattened).toHaveLength(2);
    expect(flattened.map((item) => item.field)).toEqual(['filter', 'filter.page']);
  });
});
