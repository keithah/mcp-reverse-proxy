// Global type declarations for packages without TypeScript definitions

declare module 'greenlock-express' {
  const greenlock: any;
  export default greenlock;
}

declare module 'node-forge' {
  const forge: any;
  export default forge;
}

declare module 'portscanner' {
  const portscanner: any;
  export default portscanner;
}

declare module 'jsonrpc-lite' {
  export const JSONRPCRequest: any;
  export const JSONRPCResponse: any;
  export const parseJSONRPCMessage: any;
  export const parseJSONRPCRequest: any;
}

declare module 'nat-upnp' {
  const natUpnp: any;
  export default natUpnp;
}