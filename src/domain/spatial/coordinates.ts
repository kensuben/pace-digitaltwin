export interface Point2D {
  x: number;
  y: number;
}

export interface AffineTransform2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface ScaleCalibrationInput {
  pointA: Point2D;
  pointB: Point2D;
  realDistanceMeters: number;
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function assertPoint(point: Point2D, label: string) {
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

export function calculateMetersPerPdfPoint({
  pointA,
  pointB,
  realDistanceMeters,
}: ScaleCalibrationInput): number {
  assertPoint(pointA, "pointA");
  assertPoint(pointB, "pointB");
  assertFinite(realDistanceMeters, "realDistanceMeters");
  if (realDistanceMeters <= 0) {
    throw new Error("realDistanceMeters must be greater than zero.");
  }

  const pdfDistance = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
  if (pdfDistance === 0) {
    throw new Error("Calibration points must be different.");
  }
  return realDistanceMeters / pdfDistance;
}

export function applyAffineTransform(
  point: Point2D,
  transform: AffineTransform2D,
): Point2D {
  assertPoint(point, "point");
  for (const [key, value] of Object.entries(transform)) {
    assertFinite(value, `transform.${key}`);
  }
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

export function invertAffineTransform(
  transform: AffineTransform2D,
): AffineTransform2D {
  for (const [key, value] of Object.entries(transform)) {
    assertFinite(value, `transform.${key}`);
  }
  const determinant = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error("Affine transform is not invertible.");
  }

  return {
    a: transform.d / determinant,
    b: -transform.b / determinant,
    c: -transform.c / determinant,
    d: transform.a / determinant,
    e: (transform.c * transform.f - transform.d * transform.e) / determinant,
    f: (transform.b * transform.e - transform.a * transform.f) / determinant,
  };
}

export function createPdfToFloorTransform(
  pdfOrigin: Point2D,
  floorOriginMeters: Point2D,
  metersPerPdfPoint: number,
  rotationDegrees = 0,
): AffineTransform2D {
  assertPoint(pdfOrigin, "pdfOrigin");
  assertPoint(floorOriginMeters, "floorOriginMeters");
  assertFinite(metersPerPdfPoint, "metersPerPdfPoint");
  assertFinite(rotationDegrees, "rotationDegrees");
  if (metersPerPdfPoint <= 0) {
    throw new Error("metersPerPdfPoint must be greater than zero.");
  }

  const radians = (rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians) * metersPerPdfPoint;
  const sine = Math.sin(radians) * metersPerPdfPoint;
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: floorOriginMeters.x - cosine * pdfOrigin.x + sine * pdfOrigin.y,
    f: floorOriginMeters.y - sine * pdfOrigin.x - cosine * pdfOrigin.y,
  };
}
