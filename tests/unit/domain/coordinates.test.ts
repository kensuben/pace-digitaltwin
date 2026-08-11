import { describe, expect, it } from "vitest";

import {
  applyAffineTransform,
  calculateMetersPerPdfPoint,
  createPdfToFloorTransform,
  invertAffineTransform,
} from "@/domain/spatial/coordinates";

describe("spatial coordinates", () => {
  it("calculates a meter scale from two PDF points", () => {
    expect(
      calculateMetersPerPdfPoint({
        pointA: { x: 10, y: 20 },
        pointB: { x: 13, y: 24 },
        realDistanceMeters: 2.5,
      }),
    ).toBe(0.5);
  });

  it("rejects invalid calibration input", () => {
    expect(() =>
      calculateMetersPerPdfPoint({
        pointA: { x: 1, y: 1 },
        pointB: { x: 1, y: 1 },
        realDistanceMeters: 1,
      }),
    ).toThrow("different");
    expect(() =>
      calculateMetersPerPdfPoint({
        pointA: { x: 0, y: 0 },
        pointB: { x: 1, y: 1 },
        realDistanceMeters: 0,
      }),
    ).toThrow("greater than zero");
    expect(() =>
      calculateMetersPerPdfPoint({
        pointA: { x: Number.NaN, y: 0 },
        pointB: { x: 1, y: 1 },
        realDistanceMeters: 1,
      }),
    ).toThrow("finite");
  });

  it("maps PDF coordinates to canonical floor meters and back", () => {
    const transform = createPdfToFloorTransform(
      { x: 100, y: 50 },
      { x: 2, y: 3 },
      0.02,
      90,
    );
    const floorPoint = applyAffineTransform({ x: 110, y: 50 }, transform);
    expect(floorPoint.x).toBeCloseTo(2);
    expect(floorPoint.y).toBeCloseTo(3.2);

    const restored = applyAffineTransform(
      floorPoint,
      invertAffineTransform(transform),
    );
    expect(restored.x).toBeCloseTo(110);
    expect(restored.y).toBeCloseTo(50);
  });

  it("rejects invalid or singular affine transforms", () => {
    expect(() =>
      createPdfToFloorTransform({ x: 0, y: 0 }, { x: 0, y: 0 }, -1),
    ).toThrow("greater than zero");
    expect(() =>
      applyAffineTransform(
        { x: 0, y: 0 },
        { a: Number.POSITIVE_INFINITY, b: 0, c: 0, d: 1, e: 0, f: 0 },
      ),
    ).toThrow("finite");
    expect(() =>
      invertAffineTransform({ a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 }),
    ).toThrow("not invertible");
  });
});
