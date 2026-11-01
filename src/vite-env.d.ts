/// <reference types="vite/client" />

/** Vite `?worker` içe aktarımları için tip bildirimi. */
declare module '*?worker' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}
