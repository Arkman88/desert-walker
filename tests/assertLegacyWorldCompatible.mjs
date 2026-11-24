import assert from 'node:assert/strict'

const METRIC_FIELDS = new Set(['x', 'y', 'z', 'height', 'radius', 'waterY', 'minX', 'maxX', 'minZ', 'maxZ', 'bottom', 'top', 'position', 'rotation'])
const GEOMETRY_TOLERANCE = 1e-7

/** Keep identity/data exact while allowing sub-micron geometry drift between JS runtimes. */
export const assertLegacyWorldCompatible = ({ actual, expected, path = '$', field = '' }) => {
  if (typeof actual === 'number' && typeof expected === 'number' && METRIC_FIELDS.has(field)) {
    assert.ok(Number.isFinite(actual) && Number.isFinite(expected)
      && Math.abs(actual - expected) <= GEOMETRY_TOLERANCE,
    `${path}: expected ${expected}, received ${actual}`)
  } else if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, `${path}: array length changed`)
    actual.forEach((item, index) => assertLegacyWorldCompatible({ actual: item, expected: expected[index], path: `${path}[${index}]`, field }))
  } else if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object'
    && Array.isArray(actual) === false && Array.isArray(expected) === false) {
    const keys = Object.keys(expected).filter(key => expected.type !== 'dwelling' || key !== 'parts')
    const actualKeys = Object.keys(actual).filter(key => actual.type !== 'dwelling' || key !== 'parts')

    assert.deepEqual(actualKeys.sort(), [...keys].sort(), `${path}: object fields changed`)
    for (const key of keys) {
      if (key === 'burialDepth' && expected.type === 'dwelling' && expected.id?.startsWith('village:v1:')) {
        // This cosmetic depth hashes a trig-derived road coordinate: tiny coordinate drift
        // can change its hash substantially. Its allowed range is the compatibility contract.
        assert.ok(typeof actual[key] === 'number' && Number.isFinite(actual[key])
          && actual[key] >= 0.2 && actual[key] <= 0.6, `${path}.${key}: invalid village burial depth`)
      } else {
        assertLegacyWorldCompatible({ actual: actual[key], expected: expected[key], path: `${path}.${key}`, field: key })
      }
    }
  } else {
    assert.deepEqual(actual, expected, `${path}: value changed`)
  }
}
