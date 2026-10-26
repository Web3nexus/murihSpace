import { describe, expect, it } from 'vitest';
import { unwrapPayload } from './directory';

describe('unwrapPayload', () => {
  it('reads the list inside the API envelope', () => {
    const body = { success: true, data: { data: [{ device_uuid: 'a' }] } };
    expect(unwrapPayload(body)).toEqual([{ device_uuid: 'a' }]);
  });

  it('reads a single object inside the envelope', () => {
    const body = { success: true, data: { data: { device_uuid: 'd1' } } };
    expect(unwrapPayload(body)).toEqual({ device_uuid: 'd1' });
  });

  it('accepts a payload with one wrapper level', () => {
    expect(unwrapPayload({ data: { device_uuid: 'd2' } })).toEqual({ device_uuid: 'd2' });
  });

  it('keeps an unwrapped array as it is', () => {
    expect(unwrapPayload([{ id: 1 }])).toEqual([{ id: 1 }]);
  });
});
