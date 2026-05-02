export const calculateWeightedAverageCost = (currentStock, currentCost, incomingQuantity, incomingUnitCost) => {
  const stock = Math.max(0, Number(currentStock || 0));
  const quantity = Math.max(0, Number(incomingQuantity || 0));
  const oldCost = Math.max(0, Number(currentCost || 0));
  const newCost = Math.max(0, Number(incomingUnitCost || 0));

  if (quantity <= 0) return oldCost;
  if (stock <= 0) return newCost;

  return ((stock * oldCost) + (quantity * newCost)) / (stock + quantity);
};
