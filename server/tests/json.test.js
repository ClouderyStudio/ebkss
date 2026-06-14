import { describe, expect, it } from 'vitest';
import { extractJson } from '../src/utils/json.js';

describe('extractJson', () => {
  it('parses fenced json object', () => {
    expect(extractJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('extracts arrays from surrounding text', () => {
    expect(extractJson('结果如下：[{"a":1}]')).toEqual([{ a: 1 }]);
  });
});

