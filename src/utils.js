export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function getRect(entity) {
  return {
    x: entity.x,
    y: entity.y,
    width: entity.width,
    height: entity.height,
  };
}

export function rectOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
