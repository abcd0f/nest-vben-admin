import { describe, expect, it } from 'vitest';
import { SnowflakeIdGenerator } from './snowflake-id.js';

describe('SnowflakeIdGenerator', () => {
  it('generates unique signed BIGINT IDs across nodes and sequence rollover', () => {
    let time = 1760000000000;
    let reads = 0;
    const clock = () => {
      if (++reads > 4100) time++;
      return time;
    };
    const first = new SnowflakeIdGenerator(0, 0, clock);
    const second = new SnowflakeIdGenerator(1, 0, () => time);
    const ids = new Set<bigint>();
    for (let i = 0; i < 5000; i++) ids.add(first.nextId());
    ids.add(second.nextId());
    expect(ids.size).toBe(5001);
    expect([...ids].every((id) => id > 0n && id <= 9223372036854775807n)).toBe(true);
  });

  it('rejects invalid node configuration and clock rollback', () => {
    expect(() => new SnowflakeIdGenerator(32, 0)).toThrow('workerId');
    let time = 1760000000000;
    const generator = new SnowflakeIdGenerator(0, 0, () => time);
    generator.nextId();
    time--;
    expect(() => generator.nextId()).toThrow('Clock moved backwards');
  });
});
