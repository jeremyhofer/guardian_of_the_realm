import { test, expect } from '@jest/globals';

import * as utils from '../utils';

test('should return random value in range', () => {
  const result = utils.getRandomValueInRange(1, 10);
  expect(result).toBeGreaterThanOrEqual(1);
  expect(result).toBeLessThanOrEqual(10);
});
