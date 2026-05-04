const toPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

const roundCost = (value) => Math.round(toPositiveNumber(value));

export const calculateWeightedAverageCost = (currentStock, currentCost, incomingQuantity, incomingUnitCost) => {
  const stock = toPositiveNumber(currentStock);
  const quantity = toPositiveNumber(incomingQuantity);
  const oldCost = toPositiveNumber(currentCost);
  const newCost = toPositiveNumber(incomingUnitCost);

  if (quantity <= 0) return roundCost(oldCost);
  if (stock <= 0) return roundCost(newCost);

  return roundCost(((stock * oldCost) + (quantity * newCost)) / (stock + quantity));
};
