import EventEmitter from 'node:events';

export const emitter = new EventEmitter();

export const notifyLoaderToReload = ({ request, chanel }: { request: Request; chanel?: string }) => {
  if (!chanel) {
    chanel = new URL(request.url).pathname.replace('/', '');
  }
  emitter.emit(chanel, new Date().toISOString());
};
