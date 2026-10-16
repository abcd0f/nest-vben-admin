// MyBatis-Plus ASSIGN_ID uses the Twitter epoch and a 5/5/12 bit node/sequence layout.
const EPOCH = 1288834974657n;
const MAX_NODE = 31;
const MAX_SEQUENCE = 4095n;
const MAX_TIMESTAMP = (1n << 41n) - 1n;

export class SnowflakeIdGenerator {
  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(
    private readonly workerId: number,
    private readonly datacenterId: number,
    private readonly clock: () => number = Date.now,
  ) {
    for (const [name, value] of [['workerId', workerId], ['datacenterId', datacenterId]] as const) {
      if (!Number.isInteger(value) || value < 0 || value > MAX_NODE) {
        throw new Error(`${name} must be an integer from 0 to ${MAX_NODE}`);
      }
    }
  }

  nextId(): bigint {
    let timestamp = BigInt(this.clock());
    if (timestamp < this.lastTimestamp) throw new Error('Clock moved backwards; refusing to generate a duplicate ID');
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        do {
          timestamp = BigInt(this.clock());
        } while (timestamp <= this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }
    const elapsed = timestamp - EPOCH;
    if (elapsed < 0n || elapsed > MAX_TIMESTAMP) throw new Error('Snowflake timestamp is outside the signed BIGINT range');
    this.lastTimestamp = timestamp;
    return (elapsed << 22n) | (BigInt(this.datacenterId) << 17n) | (BigInt(this.workerId) << 12n) | this.sequence;
  }
}

function configuredNode(name: string): number {
  const value = process.env[name];
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${name} must be configured as an integer from 0 to ${MAX_NODE}`);
  }
  return Number(value);
}

let generator: SnowflakeIdGenerator | undefined;

export function nextSnowflakeId(): bigint {
  generator ??= new SnowflakeIdGenerator(
    configuredNode('SNOWFLAKE_WORKER_ID'),
    configuredNode('SNOWFLAKE_DATACENTER_ID'),
  );
  return generator.nextId();
}
