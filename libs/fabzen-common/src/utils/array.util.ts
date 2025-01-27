export function splitArrayByPredicate<T>(
  items: T[],
  predicate: (a: T, b: T) => boolean,
): T[][] {
  const result: T[][] = [];
  for (const item of items) {
    let foundGroup = false;
    for (const group of result) {
      let canBePut = true;
      for (const referenceItem of group) {
        if (predicate(referenceItem, item)) {
          canBePut = false;
          break;
        }
      }
      if (canBePut) {
        group.push(item);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      result.push([item]);
    }
  }
  return result;
}
