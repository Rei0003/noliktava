export function checkText(errors, value, label, min, max) {
  const text = String(value ?? '').trim();
  if (text.length < min) {
    errors.push(min === 1 ? `Lauks „${label}“ ir obligāts.` : `Laukā „${label}“ jābūt vismaz ${min} simboliem.`);
  } else if (text.length > max) {
    errors.push(`Laukā „${label}“ var būt ne vairāk kā ${max} simboli.`);
  }
  return text;
}

export function checkNumber(errors, value, label, min, max, allowDecimals = false) {
  const number = Number(value);
  if (value === '' || value === undefined || Number.isNaN(number)) {
    errors.push(`Laukā „${label}“ jābūt skaitlim.`);
  } else if (!allowDecimals && !Number.isInteger(number)) {
    errors.push(`Laukā „${label}“ jābūt veselam skaitlim.`);
  } else if (number < min || number > max) {
    errors.push(`Laukam „${label}“ jābūt no ${min} līdz ${max}.`);
  }
  return number;
}

export function checkPattern(errors, value, pattern, message) {
  if (value && !pattern.test(value)) errors.push(message);
}

export function checkChoice(errors, value, allowed, label) {
  if (!allowed.includes(value)) errors.push(`Nederīga vērtība laukā „${label}“.`);
  return value;
}
