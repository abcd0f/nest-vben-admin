import { BigIntIdPipe } from './bigint-id.pipe.js';

describe('bigIntIdPipe', () => {
  const pipe = new BigIntIdPipe();

  it('keeps IDs above Number.MAX_SAFE_INTEGER exact', () => {
    expect(pipe.transform('9007199254740993')).toBe(9007199254740993n);
  });

  it.each(['0', '-1', '+1', '01', '1.0', 'abc', '9223372036854775808'])('rejects invalid ID %s', (value) => {
    expect(() => pipe.transform(value)).toThrow();
  });
});
