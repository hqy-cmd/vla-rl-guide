export const bus = new EventTarget();
export const emit = (type, detail) =>
  bus.dispatchEvent(new CustomEvent(type, { detail }));
