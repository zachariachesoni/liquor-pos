const padDatePart = (value) => String(value).padStart(2, '0');

export const toDateInputValue = (date = new Date()) => {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  return [
    normalizedDate.getFullYear(),
    padDatePart(normalizedDate.getMonth() + 1),
    padDatePart(normalizedDate.getDate())
  ].join('-');
};

export const parseDateInputValue = (value) => {
  if (typeof value !== 'string') {
    return value instanceof Date ? value : new Date();
  }

  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};

export const getSameDayPreviousMonth = (value = new Date()) => {
  const sourceDate = parseDateInputValue(value);
  const targetMonthStart = new Date(sourceDate.getFullYear(), sourceDate.getMonth() - 1, 1);
  const targetMonthLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();

  targetMonthStart.setDate(Math.min(sourceDate.getDate(), targetMonthLastDay));
  return toDateInputValue(targetMonthStart);
};

export const getSameRangePreviousMonth = (range = {}) => ({
  start: getSameDayPreviousMonth(range.start),
  end: getSameDayPreviousMonth(range.end)
});
