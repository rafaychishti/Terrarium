declare const unit: unique symbol;

export type Millimetres = number & { readonly [unit]: "mm" };
export type Millilitres = number & { readonly [unit]: "ml" };
export type Grams = number & { readonly [unit]: "g" };
export type Celsius = number & { readonly [unit]: "celsius" };
export type JarHours = number & { readonly [unit]: "jar-hours" };

export const mm = (value: number): Millimetres => value as Millimetres;
export const ml = (value: number): Millilitres => value as Millilitres;
export const g = (value: number): Grams => value as Grams;
export const celsius = (value: number): Celsius => value as Celsius;
export const jarHours = (value: number): JarHours => value as JarHours;

export const centimetresToMillimetres = (value: number): Millimetres =>
  mm(value * 10);
export const litresToMillilitres = (value: number): Millilitres =>
  ml(value * 1000);
export const kilogramsToGrams = (value: number): Grams => g(value * 1000);
